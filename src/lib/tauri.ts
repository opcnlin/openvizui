import { invoke } from '@tauri-apps/api/core';

export interface EnvironmentStatus {
  node_version: string | null;
  npm_version: string | null;
  git_version: string | null;
  python_version: string | null;
  go_version: string | null;
  java_version: string | null;
}

export const checkEnvironment = async (): Promise<EnvironmentStatus> => {
  try {
    return await invoke('check_environment');
  } catch (e) {
    console.warn("Tauri invoke failed, falling back to mock data (Browser Mode)", e);
    // Return mock data for browser preview
    return {
      node_version: "v20.11.0 (Mock)",
      npm_version: "10.2.4 (Mock)",
      git_version: "2.43.0.windows.1 (Mock)",
      python_version: "3.12.1 (Mock)",
      go_version: "go1.22.0 windows/amd64 (Mock)",
      java_version: "openjdk version \"21.0.2\" 2024-01-16 (Mock)",
    };
  }
};

export const launchTool = async (toolId: string): Promise<string> => {
    try {
        return await invoke('launch_tool', { toolId });
    } catch (e) {
        console.warn("Launch failed (Browser Mode)", e);
        return `Mock Launched ${toolId}`;
    }
};

export interface ToolStatus {
  id: string;
  installed: boolean;
  version: string | null;
}

export const checkToolStatus = async (toolId: string): Promise<ToolStatus> => {
    try {
        return await invoke('check_tool_status', { toolId });
    } catch (e) {
        console.warn("Check status failed (Browser Mode)", e);
        return { id: toolId, installed: false, version: null };
    }
}

export const installTool = async (toolId: string): Promise<string> => {
    try {
        return await invoke('install_tool', { toolId });
    } catch (e) {
         console.warn("Install failed (Browser Mode)", e);
         return `Mock Installed ${toolId}`;
    }
};

export const uninstallTool = async (toolId: string): Promise<string> => {
    try {
        return await invoke('uninstall_tool', { toolId });
    } catch (e) {
         console.warn("Uninstall failed (Browser Mode)", e);
         return `Mock Uninstalled ${toolId}`;
    }
};

export const updateTool = async (toolId: string): Promise<string> => {
    try {
        return await invoke('update_tool', { toolId });
    } catch (e) {
         console.warn("Update failed (Browser Mode)", e);
         return `Mock Updated ${toolId}`;
    }
};

export interface ApiConfig {
    id: string;
    name: string;
    auth_type: 'api_key' | 'oauth';
    base_url: string | null;
    api_key: string | null;
    model: string | null;
}

export interface AppConfig {
    api_configs: ApiConfig[] | null;
    active_api_id: string | null;
    proxy_type: string | null;
    proxy_address: string | null;
    theme: string | null;
    language: string | null;
    active_tools: string[] | null;
    primary_color: string | null;
    opacity: number | null;
    font_family: string | null;
    text_color: string | null;
    // Terminal settings
    terminal_font_family: string | null;
    terminal_font_size: number | null;
    terminal_background: string | null;
    terminal_foreground: string | null;
    terminal_cursor_style: string | null;
    terminal_shell: string | null;
    current_directory: string | null;
    active_tool_id: string | null;
    env_status: EnvironmentStatus | null;
    tool_statuses: Record<string, ToolStatus> | null;
    tool_configs: Record<string, { active_api_id: string | null; working_directory: string | null }> | null;
}

export const getAppConfig = async (): Promise<AppConfig> => {
    try {
        return await invoke('get_app_config');
    } catch (e) {
        console.warn("Get Config failed (Browser Mode)", e);
        return {
            api_configs: [],
            active_api_id: null,
            proxy_type: 'none',
            proxy_address: '',
            theme: 'light',
            language: 'en',
            active_tools: [],
            primary_color: '#1677ff',
            opacity: 1.0,
            font_family: 'Segoe UI',
            text_color: null,
            terminal_font_family: 'Cascadia Code',
            terminal_font_size: 14,
            terminal_background: '#1e1e1e',
            terminal_foreground: '#d4d4d4',
            terminal_cursor_style: 'block',
            terminal_shell: 'powershell.exe',
            current_directory: null,
            active_tool_id: null,
            env_status: null,
            tool_statuses: null,
            tool_configs: null
        };
    }
};

export const saveAppConfig = async (config: AppConfig): Promise<void> => {
    try {
        await invoke('save_app_config', { config });
    } catch (e) {
        console.warn("Save Config failed (Browser Mode)", e);
    }
};

export const openUrl = async (url: string): Promise<void> => {
    try {
        await invoke('open_url', { url });
    } catch (e) {
        console.warn("Open URL failed", e);
        window.open(url, '_blank');
    }
};

export const ptyOpen = async (cols: number, rows: number): Promise<void> => {
    try {
        await invoke('pty_open', { cols, rows });
    } catch (e) {
        console.warn("PTY Open failed", e);
    }
};

export const ptyClose = async (): Promise<void> => {
    try {
        await invoke('pty_close');
    } catch (e) {
        console.warn("PTY Close failed", e);
    }
};

export const ptyWrite = async (data: string): Promise<void> => {
    try {
        await invoke('pty_write', { data });
    } catch (e) {
        console.warn("PTY Write failed", e);
    }
};

export const ptyResize = async (cols: number, rows: number): Promise<void> => {
    try {
        await invoke('pty_resize', { cols, rows });
    } catch (e) {
        console.warn("PTY Resize failed", e);
    }
};
