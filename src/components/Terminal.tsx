import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { Button, Tooltip, Space, theme as antdTheme, message } from 'antd';
import { 
  ClearOutlined, 
  ReloadOutlined, 
  FolderOpenOutlined
} from '@ant-design/icons';
import '@xterm/xterm/css/xterm.css';
import { ptyOpen, ptyWrite, ptyResize, ptyClose } from '../lib/tauri';
import { useAppStore } from '../store/appStore';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

const Terminal = () => {
  const navigate = useNavigate();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { 
    terminalFontFamily, 
    terminalFontSize, 
    terminalBackground, 
    terminalForeground,
    terminalCursorStyle,
    terminalShell,
    pendingCommand,
    setPendingCommand,
    currentDirectory,
    setCurrentDirectory
  } = useAppStore();
  const { token } = antdTheme.useToken();
  const { t } = useTranslation();

  const getSafeFont = (font: string) => {
    return `"${font}", "Cascadia Code", "Consolas", "Courier New", monospace`;
  };

  const printBanner = (term: XTerminal) => {
    const banner = [
      '\r\n',
      '  \x1b[1;34m╭────────────────────────────────────────────────╮\x1b[0m',
      '  \x1b[1;34m│\x1b[0m                                                \x1b[1;34m│\x1b[0m',
      '  \x1b[1;34m│\x1b[0m   \x1b[1;36mOpenVizUI Native Terminal\x1b[0m                    \x1b[1;34m│\x1b[0m',
      '  \x1b[1;34m│\x1b[0m   \x1b[90mEnhanced Productivity for AI CLI Tools\x1b[0m       \x1b[1;34m│\x1b[0m',
      '  \x1b[1;34m│\x1b[0m                                                \x1b[1;34m│\x1b[0m',
      '  \x1b[1;34m╰────────────────────────────────────────────────╯\x1b[0m',
      '\r\n'
    ].join('\r\n');
    term.write(banner);
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      cursorStyle: terminalCursorStyle,
      fontFamily: getSafeFont(terminalFontFamily),
      fontSize: terminalFontSize,
      allowProposedApi: true,
      theme: {
        background: terminalBackground,
        foreground: terminalForeground,
        cursor: terminalForeground 
      }
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle OSC 7 (Current Working Directory)
    term.parser.registerOscHandler(7, (data) => {
      try {
        // OSC 7 data is typically file://host/path
        let path = '';
        if (data.startsWith('file://')) {
          const url = new URL(data);
          path = decodeURIComponent(url.pathname);
        } else {
          path = data;
        }

        // Windows path cleanup: /C:/Users/... -> C:\Users\...
        if (path.startsWith('/') && path.length > 2 && path.charAt(2) === ':') {
          path = path.substring(1).replace(/\//g, '\\');
        }

        if (path) {
          setCurrentDirectory(path);
        }
      } catch (e) {
        // Silently fail for malformed OSC data
      }
      return true;
    });

    const initPty = async () => {
      // 1. Register data listener first so we don't miss the initial prompt
      const unlisten = await listen<string>('pty-data', (event) => {
        term.write(event.payload);
      });

      // 2. Bind terminal input to PTY write
      term.onData((data) => {
        ptyWrite(data);
      });

      // 3. Fit dimensions FIRST to ensure we know the correct size
      fitAddon.fit();
      const initialCols = term.cols;
      const initialRows = term.rows;

      // 4. Print UI banner
      term.write('\x1b[2J\x1b[H'); 
      printBanner(term);
      term.write(`\r\n\x1b[1;32m➜\x1b[0m \x1b[1mReady to work!\x1b[0m\r\n\r\n`);
      
      // 5. Open the PTY and Resize immediately
      try {
        // --- Added: Check for Git before opening PTY ---
        try {
            const gitVersion = await invoke('check_executable', { program: 'git', args: ['--version'] });
            if (!gitVersion) {
                message.warning(t('apps.messages.gitMissing'));
                setTimeout(() => {
                    navigate('/apps', { state: { activeTab: 'tools' } });
                }, 2000);
                return;
            }
        } catch (e) {
            message.warning(t('apps.messages.gitMissing'));
            setTimeout(() => {
                navigate('/apps', { state: { activeTab: 'tools' } });
            }, 2000);
            return;
        }

        await ptyClose(); // Clean up any existing session
        await ptyOpen(initialCols, initialRows);
        
        // Force a clear screen (Ctrl+L) to remove potential double prompts from shell startup
        setTimeout(() => {
             ptyWrite('\x0c'); 
        }, 500);
        
      } catch (e) {
        console.error('PTY Open failed', e);
        term.write(`\r\n\x1b[1;31mError: Failed to open terminal session.\x1b[0m\r\n`);
        return () => unlisten();
      }

      const handleResize = () => {
        fitAddon.fit();
        if (term.cols > 0 && term.rows > 0) {
            ptyResize(term.cols, term.rows);
        }
      };
      
      const resizeObserver = new ResizeObserver(() => {
          // Debounce slightly or just call
          handleResize();
      });
      
      if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current);
      }

      return () => {
        unlisten();
        resizeObserver.disconnect();
        term.dispose();
        ptyClose(); // Close the PTY backend when component unmounts
      };
    };

    const cleanupPromise = initPty();
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, []);

  useEffect(() => {
    if (pendingCommand && xtermRef.current) {
        setTimeout(() => {
            ptyWrite(pendingCommand + '\r');
            setPendingCommand(null);
        }, 1000);
    }
  }, [pendingCommand]);

  useEffect(() => {
    if (xtermRef.current) {
       xtermRef.current.options.fontFamily = getSafeFont(terminalFontFamily);
       xtermRef.current.options.fontSize = terminalFontSize;
       xtermRef.current.options.cursorStyle = terminalCursorStyle;
       xtermRef.current.options.theme = {
         background: terminalBackground,
         foreground: terminalForeground,
         cursor: terminalForeground
       };
       setTimeout(() => {
         fitAddonRef.current?.fit();
         if (xtermRef.current) {
            ptyResize(xtermRef.current.cols, xtermRef.current.rows);
         }
       }, 200);
    }
  }, [terminalFontFamily, terminalFontSize, terminalBackground, terminalForeground, terminalCursorStyle]);

  const handleClear = () => {
    xtermRef.current?.clear();
  };


  const handleRestart = () => {
    window.location.reload();
  };

  const handleSelectDirectory = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: currentDirectory || undefined,
      });
      if (selected && typeof selected === 'string') {
          setCurrentDirectory(selected);
        // PowerShell does not support /d, but handles drive changes automatically.
        // cmd.exe requires /d to change drives.
        
        // Note: 'cls' works in CMD. PowerShell alias 'cls' -> Clear-Host.
        
        // Construct command chain
        // PowerShell: Clear-Host; cd "..."
        // CMD: cls & cd /d "..."
        const lowerShell = terminalShell.toLowerCase();
        let cmd = '';

        if (lowerShell.includes('powershell') || lowerShell.includes('pwsh')) {
            // PowerShell: Clear-Host; cd "..."
            cmd = `Clear-Host; cd "${selected}"`;
        } else if (lowerShell.includes('bash') || lowerShell.includes('wsl')) {
            // Bash/WSL/Git Bash: clear; cd "..."
            // Usually Git Bash handles Windows paths in quotes fine.
            cmd = `clear; cd "${selected}"`;
        } else {
            // CMD: cls & cd /d "..."
            cmd = `cls & cd /d "${selected}"`;
        }
        
        // Use Ctrl+C (\x03) to clear any existing input/prompt state
        ptyWrite('\x03');
        
        // Wait for prompt to reset/flush before sending command to avoid it being eaten by SIGINT
        setTimeout(() => {
             // Normalize path for bash environments (C:\Foo -> C:/Foo) to avoid escape issues
             if (lowerShell.includes('bash') || lowerShell.includes('wsl')) {
                 const posixPath = selected.replace(/\\/g, '/');
                 ptyWrite(`clear; cd "${posixPath}"\r`);
             } else {
                 ptyWrite(`${cmd}\r`);
             }
        }, 200);
      }
    } catch (err) {
      console.error('Failed to open directory dialog', err);
      message.error(t('terminal.dirError'));
    }
  };


  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: terminalBackground,
      borderRadius: '8px',
      overflow: 'hidden',
      border: `1px solid ${token.colorBorderSecondary}`
    }}>
      <div style={{ 
        padding: '6px 12px', 
        background: token.colorBgContainer, 
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space size="middle">

          <Tooltip title={currentDirectory || t('terminal.noDirectory')}>
            <Button 
              size="small" 
              type="text" 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectDirectory}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                color: token.colorTextSecondary,
                maxWidth: 200,
                overflow: 'hidden'
              }}
            >
              <span style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontSize: '12px'
              }}>
                {currentDirectory ? currentDirectory.split(/[\\/]/).pop() : t('terminal.workingDir')}
              </span>
            </Button>
          </Tooltip>

          <div style={{ width: 1, height: 16, background: token.colorBorderSecondary }} />
          

        </Space>
        
        <Space>
          <Tooltip title="Clear">
            <Button 
                type="text" 
                size="small" 
                icon={<ClearOutlined />} 
                onClick={handleClear}
                style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>
          <Tooltip title="Restart Session">
            <Button 
                type="text" 
                size="small" 
                icon={<ReloadOutlined />} 
                onClick={handleRestart}
                style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>
        </Space>
      </div>

      <div 
        ref={terminalRef} 
        style={{ 
          flex: 1,
          width: '100%', 
          overflow: 'hidden',
          padding: '8px',
        }} 
      />
    </div>
  );
};

export default Terminal;
