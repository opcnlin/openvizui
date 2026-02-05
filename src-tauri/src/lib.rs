use serde::{Deserialize, Serialize};
use std::process::Command;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem, MasterPty};
use std::sync::{Arc, Mutex};
use std::io::{Read, Write};
use std::thread;
use std::cmp::min;
use futures_util::StreamExt; // For streaming response body

#[cfg(windows)]
use std::os::windows::process::CommandExt;

fn create_background_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // ash::windows::process::CREATE_NO_WINDOW
    cmd
}
struct AppPty {
    writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    master: Arc<Mutex<Option<Box<dyn MasterPty + Send>>>>,
}

impl Default for AppPty {
    fn default() -> Self {
        Self {
            writer: Arc::new(Mutex::new(None)),
            master: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentStatus {
    node_version: Option<String>,
    npm_version: Option<String>,
    git_version: Option<String>,
    python_version: Option<String>,
    go_version: Option<String>,
    java_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolStatus {
    id: String,
    installed: bool,
    version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiConfig {
    pub id: String,
    pub name: String,
    pub auth_type: String, // "api_key" | "oauth"
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolConfig {
    pub active_api_id: Option<String>,
    pub working_directory: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub api_configs: Option<Vec<ApiConfig>>,
    pub active_api_id: Option<String>,
    pub proxy_type: Option<String>,
    pub proxy_address: Option<String>,
    pub theme: Option<String>,
    pub language: Option<String>,
    pub active_tools: Option<Vec<String>>,
    pub primary_color: Option<String>,
    pub opacity: Option<f32>,
    pub font_family: Option<String>,
    pub text_color: Option<String>,
    // Terminal settings
    pub terminal_font_family: Option<String>,
    pub terminal_font_size: Option<u32>,
    pub terminal_background: Option<String>,
    pub terminal_foreground: Option<String>,
    pub terminal_cursor_style: Option<String>,
    pub terminal_shell: Option<String>,
    pub current_directory: Option<String>,
    pub active_tool_id: Option<String>,
    pub env_status: Option<EnvironmentStatus>,
    pub tool_statuses: Option<std::collections::HashMap<String, ToolStatus>>,
    pub tool_configs: Option<std::collections::HashMap<String, ToolConfig>>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_configs: Some(Vec::new()),
            active_api_id: None,
            proxy_type: Some("none".to_string()),
            proxy_address: None,
            theme: Some("light".to_string()),
            language: Some("en".to_string()),
            active_tools: None,
            primary_color: Some("#1677ff".to_string()),
            opacity: Some(1.0),
            font_family: Some("Segoe UI".to_string()),
            text_color: None,
            terminal_font_family: Some("Cascadia Code".to_string()),
            terminal_font_size: Some(14),
            terminal_background: Some("#1e1e1e".to_string()),
            terminal_foreground: Some("#d4d4d4".to_string()),
            terminal_cursor_style: Some("block".to_string()),
            terminal_shell: if cfg!(target_os = "windows") {
                Some("powershell.exe".to_string())
            } else {
                Some("bash".to_string())
            },
            current_directory: None,
            active_tool_id: None,
            env_status: None,
            tool_statuses: None,
            tool_configs: Some(std::collections::HashMap::new()),
        }
    }
}

fn get_config_path(_app: &AppHandle) -> PathBuf {
    let mut path = std::env::current_exe().expect("failed to get current exe path");
    path.pop(); // Remove exe name
    path.push("app");
    path.push("config");
    
    // Ensure directory exists
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    
    path.join("config.json")
}

fn get_version(program: &str, args: &[&str]) -> Option<String> {
    #[cfg(target_os = "windows")]
    let program = if program == "npm" { "npm.cmd" } else { program };

    create_background_command(program)
        .args(args)
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() || !output.stderr.is_empty() {
                // Combine stdout and stderr because some tools (like java) output version to stderr
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let combined = format!("{}{}", stdout, stderr);
                
                // Return only the first non-empty line
                combined.lines()
                    .map(|l| l.trim())
                    .find(|l| !l.is_empty())
                    .map(|s| s.to_string())
            } else {
                None
            }
        })
}

#[tauri::command]
fn check_executable(program: String, args: Vec<String>) -> Option<String> {
    get_version(&program, &args.iter().map(|s| s.as_str()).collect::<Vec<&str>>())
}

#[tauri::command]
fn check_environment() -> EnvironmentStatus {
    EnvironmentStatus {
        node_version: get_version("node", &["-v"]),
        npm_version: get_version("npm", &["-v"]),
        git_version: get_version("git", &["--version"]),
        python_version: get_version("python", &["--version"])
            .or_else(|| get_version("python3", &["--version"])),
        go_version: get_version("go", &["version"]),
        java_version: get_version("java", &["-version"]),
    }
}

#[tauri::command]
fn launch_tool(tool_id: String) -> Result<String, String> {
    let program = match tool_id.as_str() {
        "claude" => "claude",
        "google" => "gemini",
        "opencode" => "opencode",
        "openclaw" => "openclaw",
        "iflow" => "iflow",
        "codebuddy" => "codebuddy",
        "copilot" => "copilot",
        "codex" => "codex",
        "kilocode" => "kilocode",
        "grok" => "grok",
        _ => return Err("Unknown tool".to_string()),
    };
    
    // Windows-specific handling for cmd/powershell (variables currently unused, keeping logic simple for now)
    
    // Launch in a new terminal window
    #[cfg(target_os = "windows")]
    Command::new("cmd")
        .args(&["/C", "start", "powershell", "-NoExit", "-Command", program])
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .args(&["-a", "Terminal", program])
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("x-terminal-emulator")
        .args(&["-e", program])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(format!("Launched {}", tool_id))
}

#[tauri::command]
fn install_tool(tool_id: String) -> Result<String, String> {
    let install_package = match tool_id.as_str() {
        "claude" => "@anthropic-ai/claude-code",
        "google" => "@google/gemini-cli",
        "opencode" => "opencode-ai",
        "openclaw" => "openclaw",
        "iflow" => "@iflow-ai/iflow-cli@latest",
        "codebuddy" => "@tencent-ai/codebuddy-code",
        "copilot" => "@github/copilot",
        "codex" => "@openai/codex",
        "kilocode" => "@kilocode/cli",
        "grok" => "@vibe-kit/grok-cli",
        _ => return Err("Installation not supported for this tool yet".to_string()),
    };

    // This is a simplified install command execution
    // Ideally we stream output to frontend, here we just wait
    // Note: This blocks the thread, should use async command in real app
    // Determine the npm program and arguments based on OS
    let (program, args) = if cfg!(target_os = "windows") {
        ("npm.cmd", vec!["install", "-g", install_package])
    } else {
        ("npm", vec!["install", "-g", install_package])
    };
    
    println!("Executing install command: {} {:?}", program, args);

    let output = create_background_command(program)
         .args(&args)
         .output()
         .map_err(|e| {
             let err_msg = e.to_string();
             println!("Install command failed to launch: {}", err_msg);
             err_msg
         })?;

    if output.status.success() {
        println!("npm install finished. Verifying {}...", tool_id);
        // Verify installation by checking status
        let status = check_tool_status(tool_id.clone());
        if status.installed {
             println!("Verification successful: {} is installed (v{:?}).", tool_id, status.version);
             Ok("Installation successful".to_string())
        } else {
             println!("Verification failed: {} not found after install.", tool_id);
             Err(format!("Installation appeared successful but tool {} was not found. Please check PATH.", tool_id))
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        println!("Installation of {} failed. Stderr: {}", tool_id, stderr);
        Err(stderr)
    }
}

#[tauri::command]
async fn update_tool(tool_id: String) -> Result<String, String> {
    let package = match tool_id.as_str() {
        "claude" => "@anthropic-ai/claude-code@latest",
        "google" => "@google/gemini-cli@latest",
        "opencode" => "opencode-ai@latest",
        "openclaw" => "openclaw@latest",
        "iflow" => "@iflow-ai/iflow-cli@latest",
        "codebuddy" => "@tencent-ai/codebuddy-code@latest",
        "copilot" => "@github/copilot@latest",
        "codex" => "@openai/codex@latest",
        "kilocode" => "@kilocode/cli@latest",
        "grok" => "@vibe-kit/grok-cli@latest",
        _ => return Err("Update not supported for this tool".to_string()),
    };

    let (program, args) = if cfg!(target_os = "windows") {
        ("npm.cmd", vec!["install", "-g", package])
    } else {
        ("npm", vec!["install", "-g", package])
    };

    let output = create_background_command(program)
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok("Update successful".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}


#[tauri::command]
fn uninstall_tool(tool_id: String) -> Result<String, String> {
    let uninstall_cmd = match tool_id.as_str() {
        "claude" => "npm uninstall -g @anthropic-ai/claude-code",
        "google" => "npm uninstall -g @google/gemini-cli",
        "opencode" => "npm uninstall -g opencode-ai",
        "openclaw" => "npm uninstall -g openclaw",
        "iflow" => "npm uninstall -g @iflow-ai/iflow-cli",
        "codebuddy" => "npm uninstall -g @tencent-ai/codebuddy-code",
        "copilot" => "npm uninstall -g @github/copilot",
        "codex" => "npm uninstall -g @openai/codex",
        "kilocode" => "npm uninstall -g @kilocode/cli",
        "grok" => "npm uninstall -g @vibe-kit/grok-cli",
        _ => return Err("Uninstall not supported for this tool".to_string()),
    };

    let output = create_background_command("powershell")
         .args(&["/C", uninstall_cmd]) 
         .output()
         .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok("Uninstallation successful".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn check_tool_status(tool_id: String) -> ToolStatus {
    let (program, args) = match tool_id.as_str() {
        "claude" => if cfg!(target_os = "windows") { ("claude.cmd", vec!["--version"]) } else { ("claude", vec!["--version"]) },
        "google" => if cfg!(target_os = "windows") { ("gemini.cmd", vec!["--version"]) } else { ("gemini", vec!["--version"]) },
        "opencode" => if cfg!(target_os = "windows") { ("opencode.cmd", vec!["--version"]) } else { ("opencode", vec!["--version"]) },
        "openclaw" => if cfg!(target_os = "windows") { ("openclaw.cmd", vec!["--version"]) } else { ("openclaw", vec!["--version"]) },
        "iflow" => if cfg!(target_os = "windows") { ("iflow.cmd", vec!["--version"]) } else { ("iflow", vec!["--version"]) },
        "codebuddy" => if cfg!(target_os = "windows") { ("codebuddy.cmd", vec!["--version"]) } else { ("codebuddy", vec!["--version"]) },
        "copilot" => if cfg!(target_os = "windows") { ("copilot.cmd", vec!["--version"]) } else { ("copilot", vec!["--version"]) },
        "codex" => if cfg!(target_os = "windows") { ("codex.cmd", vec!["--version"]) } else { ("codex", vec!["--version"]) },
        "kilocode" => if cfg!(target_os = "windows") { ("kilocode.cmd", vec!["--version"]) } else { ("kilocode", vec!["--version"]) },
        "grok" => if cfg!(target_os = "windows") { ("grok.cmd", vec!["--version"]) } else { ("grok", vec!["--version"]) },
        _ => return ToolStatus { id: tool_id, installed: false, version: None },
    };

    let version = get_version(program, &args);
    ToolStatus {
        id: tool_id,
        installed: version.is_some(),
        version,
    }
}

#[tauri::command]
fn get_app_config(app: AppHandle) -> AppConfig {
    let config_path = get_config_path(&app);
    if config_path.exists() {
        let content = fs::read_to_string(config_path).unwrap_or_default();
        // Use serde_json to parse. If it fails or is partial, we should merge with default
        let loaded_config: Option<AppConfig> = serde_json::from_str(&content).ok();
        
        if let Some(config) = loaded_config {
            // Ensure essential fields are not None if they shouldn't be (merging logic)
            // For now, simpler: if loaded successfully, return it. logic for active_tool_id is Option<String> so None is valid.
            config
        } else {
             // Failed to parse, return default
             AppConfig::default()
        }
    } else {
        AppConfig::default()
    }
}

#[tauri::command]
fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let config_path = get_config_path(&app);
    let dir = config_path.parent().unwrap();
    if !dir.exists() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pty_open(app: AppHandle, state: State<'_, AppPty>, cols: u16, rows: u16) -> Result<(), String> {
    let pty_system = NativePtySystem::default();
    
    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let config = get_app_config(app.clone());
    let cmd_line = config.terminal_shell.unwrap_or_else(|| {
        if cfg!(target_os = "windows") {
            "bash.exe".to_string()
        } else {
            "bash".to_string()
        }
    });

    let mut cmd = if cmd_line == "wsl" {
        CommandBuilder::new("wsl.exe")
    } else {
        // Special handling for Git Bash (bash.exe) which might not be in PATH
        let resolved_cmd = if cmd_line == "bash.exe" {
            let default_path = std::path::Path::new("C:\\Program Files\\Git\\bin\\bash.exe");
            if default_path.exists() {
               default_path.to_str().unwrap().to_string()
            } else {
               cmd_line
            }
        } else {
             cmd_line
        };

        let mut builder = CommandBuilder::new(&resolved_cmd);
        if resolved_cmd.to_lowercase().contains("powershell") {
            builder.args(&["-NoLogo"]);
        }
        // If it's bash, launch as login shell to load profile
        if resolved_cmd.ends_with("bash.exe") {
             builder.args(&["--login", "-i"]);
        }
        builder
    };

    // Suppress auto-update popups for common CLI tools
    cmd.env("CHECK_UPDATE", "0");
    cmd.env("NO_UPDATE_CHECK", "1");
    cmd.env("ADBLOCK", "1");
    cmd.env("DISABLE_UPDATE_CHECKER", "true");
    cmd.env("NPM_CONFIG_UPDATE_NOTIFIER", "false");

    if let Some(cwd) = config.current_directory {
        if !cwd.is_empty() {
            if std::path::Path::new(&cwd).exists() {
                cmd.cwd(cwd);
            } else {
                println!("Warning: Saved directory does not exist: {}", cwd);
            }
        }
    }
    
    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("Failed to spawn shell: {}", e))?;
    println!("Shell spawned successfully: {:?}", child);
    
    // Release slave immediately to allow shell to close it when it exits
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    
    // Store writer and master
    *state.writer.lock().unwrap() = Some(writer);
    *state.master.lock().unwrap() = Some(pair.master);

    // Spawn thread to read from PTY
    thread::spawn(move || {
        let mut buf = [0u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = &buf[..n];
                    let text = String::from_utf8_lossy(data).to_string();
                    let _ = app.emit("pty-data", text);
                }
                _ => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn pty_close(state: State<'_, AppPty>) -> Result<(), String> {
    *state.writer.lock().unwrap() = None;
    *state.master.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
fn pty_write(state: State<'_, AppPty>, data: String) -> Result<(), String> {
    if let Some(writer) = state.writer.lock().unwrap().as_mut() {
        write!(writer, "{}", data).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("PTY writer not initialized".to_string())
    }
}

#[tauri::command]
fn pty_resize(state: State<'_, AppPty>, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(master) = state.master.lock().unwrap().as_mut() {
        master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    opener::open(url).map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_file(app: AppHandle, url: String, filename: String) -> Result<String, String> {
    // 1. Determine download path: <AppDir>/download
    let mut download_path = std::env::current_exe().map_err(|e| e.to_string())?;
    download_path.pop(); // remove exe
    download_path.push("download");
    
    // Create dir if not exists
    if !download_path.exists() {
        fs::create_dir_all(&download_path).map_err(|e| e.to_string())?;
    }
    
    let target_path = download_path.join(&filename);
    let target_path_str = target_path.to_string_lossy().to_string();

    println!("Starting download: {} -> {}", url, target_path_str);

    // 2. Start Request
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let total_size = res.content_length().unwrap_or(0);
    
    // 3. Stream content
    let mut file = std::fs::File::create(&target_path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading chunk: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Error while writing to file: {}", e))?;
        
        let new = min(downloaded + (chunk.len() as u64), total_size);
        downloaded = new;
        
        // Emit progress
        if total_size > 0 {
             let percent = (downloaded as f64 / total_size as f64) * 100.0;
             // Emit event: "download-progress" { filename: "foo.zip", percent: 50.5, current: 1024, total: 2048 }
             let _ = app.emit("download-progress", serde_json::json!({
                 "filename": filename,
                 "percent": percent,
                 "current": downloaded,
                 "total": total_size
             }));
        }
    }

    println!("Download complete: {}", target_path_str);
    Ok(target_path_str)
}

#[tauri::command]
fn extract_file(path: String) -> Result<String, String> {
    let archive_path = PathBuf::from(&path);
    if !archive_path.exists() {
        return Err("File not found".to_string());
    }

    let mut target_dir = archive_path.clone();
    target_dir.pop(); // download dir
    
    // Create a subfolder with same name as file stem
    let stem = archive_path.file_stem().ok_or("Invalid filename")?.to_string_lossy();
    target_dir.push(&*stem);

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    }

    let file = fs::File::open(&archive_path).map_err(|e| format!("Failed to open archive: {}", e))?;

    if path.ends_with(".zip") {
        zip_extract::extract(file, &target_dir, true).map_err(|e| format!("ZIP extraction failed: {}", e))?;
    } else if path.ends_with(".tar.gz") || path.ends_with(".tgz") {
        let tar_gz = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(tar_gz);
        archive.unpack(&target_dir).map_err(|e| format!("TAR extraction failed: {}", e))?;
    } else {
        return Err("Unsupported archive format. Only .zip and .tar.gz supported.".to_string());
    }

    Ok(target_dir.to_string_lossy().to_string())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        check_environment, 
        check_tool_status,
        launch_tool, 
        install_tool,
        uninstall_tool,
        update_tool,
        check_executable,
        get_app_config,
        save_app_config,
        open_url,
        pty_open,
        pty_write,
        pty_resize,
        pty_close,
        download_file,
        extract_file
    ])
    .manage(AppPty::default())
    .setup(|app| {
      app.handle().plugin(tauri_plugin_dialog::init())?;
      app.handle().plugin(tauri_plugin_fs::init())?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
