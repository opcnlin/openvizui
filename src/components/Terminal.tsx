
import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { Button, Tooltip, Space, theme as antdTheme } from 'antd';
import { 
  ClearOutlined, 
  ReloadOutlined, 
  FolderOpenOutlined
} from '@ant-design/icons';
import '@xterm/xterm/css/xterm.css';
import { ptyOpen, ptyWrite, ptyResize, ptyClose } from '../lib/tauri';
import { useAppStore } from '../store/appStore';
import { useTranslation } from 'react-i18next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

const TerminalUI = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const { token } = antdTheme.useToken();
  useTranslation();
  
  const { 
    terminalFontFamily, 
    terminalFontSize, 
    terminalBackground, 
    terminalForeground,
    terminalCursorStyle,
    pendingCommand,
    setPendingCommand,
    currentDirectory,
    setCurrentDirectory
  } = useAppStore();

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: terminalFontFamily,
      fontSize: terminalFontSize,
      theme: {
        background: terminalBackground,
        foreground: terminalForeground,
        selectionBackground: token.colorPrimaryBg,
        cursor: token.colorPrimary
      },
      cursorStyle: terminalCursorStyle as any,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    let unlisten: () => void;

    const initPty = async () => {
      // 1. Register data listener first so we don't miss the initial prompt
      const unlistenFn = await listen<string>('pty-data', (event) => {
        term.write(event.payload);
      });
      unlisten = unlistenFn;

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
      term.write(`\x1b[1;34mOpenVizUI Terminal\x1b[0m \r\n`);
      term.write(`\x1b[2mType 'help' to see available commands or 'exit' to close.\x1b[0m\r\n\r\n`);

      // 5. Initialize PTY session
      try {
        await ptyClose(); // Clean up any existing session
        await ptyOpen(initialCols, initialRows);
        
        // Force a clear screen (Ctrl+L) to remove potential double prompts from shell startup
        setTimeout(() => {
             ptyWrite('\x0c'); 
             term.focus(); // Force focus on init
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

      window.addEventListener('resize', handleResize);
      
      return () => {
          window.removeEventListener('resize', handleResize);
          // Don't close PTY here to allow persistence, or close if you want ephemeral
          // ptyClose(); 
      };
    };

    initPty();

    return () => {
      if (unlisten) unlisten();
      term.dispose();
      xtermRef.current = null;
    };
  }, [terminalFontFamily, terminalFontSize, terminalBackground, terminalForeground, terminalCursorStyle, token]);

  // Handle pending commands (e.g. from "Launch in Terminal")
  useEffect(() => {
    if (pendingCommand && xtermRef.current) {
        // Wait a bit for shell to be ready if it's a fresh mount
        setTimeout(() => {
            ptyWrite(`${pendingCommand}\r`);
            setPendingCommand(null);
            xtermRef.current?.focus();
        }, 800);
    }
  }, [pendingCommand, setPendingCommand]);


  const handleClear = () => {
    xtermRef.current?.clear();
    xtermRef.current?.focus();
  };


  const handleRestart = () => {
    window.location.reload();
  };

  const focusTerminal = () => {
      xtermRef.current?.focus();
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
        // Change PTY directory
        ptyWrite(`cd "${selected}"\r`);
        xtermRef.current?.focus();
      }
    } catch (e) {
      console.error("Failed to select directory", e);
    }
  };


  return (
    <div 
      style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: terminalBackground,
      borderRadius: '8px',
      overflow: 'hidden',
      border: `1px solid ${token.colorBorderSecondary}`,
      cursor: 'text'
    }}
    onClick={focusTerminal}
    >
      <div style={{ 
        padding: '6px 12px', 
        background: token.colorBgContainer, 
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 40
      }}>
        <Space>
           <Button 
             type="text" 
             size="small" 
             icon={<FolderOpenOutlined />} 
             onClick={handleSelectDirectory}
           >
             {currentDirectory ? currentDirectory.split(/[\\/]/).pop() : 'No Folder'}
           </Button>
        </Space>
        
        <Space>
          <Tooltip title="Clear">
            <Button 
                type="text" 
                size="small" 
                icon={<ClearOutlined />} 
                onClick={handleClear} 
            />
          </Tooltip>
          <Tooltip title="Restart Session">
            <Button 
                type="text" 
                size="small" 
                icon={<ReloadOutlined />} 
                onClick={handleRestart} 
            />
          </Tooltip>
        </Space>
      </div>
      <div 
        ref={terminalRef} 
        style={{ 
          flex: 1, 
          padding: '8px 4px 4px 12px', 
          overflow: 'hidden' 
        }} 
      />
    </div>
  );
};

export default TerminalUI;
