/*
 * @Date: 2026-02-03 19:29:15
 * @Author: Anthony Rivera && opcnlin@gmail.com
 * @FilePath: \src\store\appStore.ts
 * Copyright (c) 2026 OpenVizUI Contributors
 * Licensed under the MIT License
 */
import { create } from 'zustand';
import { checkEnvironment, checkToolStatus, getAppConfig, saveAppConfig, type EnvironmentStatus, type ToolStatus, type ApiConfig } from '../lib/tauri';

export interface ToolConfig {
  active_api_id: string | null;
  working_directory: string | null;
}

interface AppState {
  theme: 'light' | 'dark';
  language: string;
  isLoaded: boolean;
  envStatus: EnvironmentStatus | null;
  toolStatuses: Record<string, ToolStatus>;
  toolConfigs: Record<string, ToolConfig>;
  activeTools: string[];
  primaryColor: string;
  opacity: number;
  fontFamily: string;
  textColor: string | null;
  apiConfigs: ApiConfig[];
  activeApiId: string | null;
  proxyType: string;
  proxyAddress: string;
  // Terminal settings
  terminalFontFamily: string;
  terminalFontSize: number;
  terminalBackground: string;
  terminalForeground: string;
  terminalCursorStyle: 'block' | 'underline' | 'bar';
  terminalShell: string;
  pendingCommand: string | null;
  currentDirectory: string | null;
  activeToolId: string | null;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: string) => void;
  setProxyType: (type: string) => void;
  setProxyAddress: (address: string) => void;
  setPrimaryColor: (color: string) => void;
  setOpacity: (opacity: number) => void;
  setFontFamily: (font: string) => void;
  setTextColor: (color: string) => void;
  setPendingCommand: (command: string | null) => void;
  setCurrentDirectory: (dir: string | null) => void;
  setActiveToolId: (toolId: string | null) => void;
  setTerminalSettings: (settings: Partial<{
    terminalFontFamily: string;
    terminalFontSize: number;
    terminalBackground: string;
    terminalForeground: string;
    terminalCursorStyle: 'block' | 'underline' | 'bar';
    terminalShell: string;
  }>) => void;
  addApiConfig: (config: ApiConfig) => void;
  updateApiConfig: (config: ApiConfig) => void;
  removeApiConfig: (id: string) => void;
  setActiveApiId: (id: string) => void;
  checkEnv: () => Promise<void>;
  refreshTools: (ids: string[]) => Promise<void>;
  setToolStatus: (status: ToolStatus) => void;
  setToolConfig: (toolId: string, config: Partial<ToolConfig>) => void;
  loadConfig: () => Promise<void>;
  addActiveTool: (id: string) => Promise<void>;
  removeActiveTool: (id: string) => Promise<void>;
}

const persistConfig = async (state: AppState) => {
  if (!state.isLoaded) return;
  try {
      await saveAppConfig({
          api_configs: state.apiConfigs,
          active_api_id: state.activeApiId,
          proxy_type: state.proxyType,
          proxy_address: state.proxyAddress,
          theme: state.theme,
          language: state.language,
          active_tools: state.activeTools,
          primary_color: state.primaryColor,
          opacity: state.opacity,
          font_family: state.fontFamily,
          text_color: state.textColor,
          terminal_font_family: state.terminalFontFamily,
          terminal_font_size: state.terminalFontSize,
          terminal_background: state.terminalBackground,
          terminal_foreground: state.terminalForeground,
          terminal_cursor_style: state.terminalCursorStyle,
          terminal_shell: state.terminalShell,
          current_directory: state.currentDirectory,
          active_tool_id: state.activeToolId,
          env_status: state.envStatus,
          tool_statuses: state.toolStatuses,
          tool_configs: state.toolConfigs as any,
      });
  } catch (e) {
      console.error("Failed to persist config", e);
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'light',
  language: 'zh',
  isLoaded: false,
  envStatus: null,
  toolStatuses: {},
  toolConfigs: {},
  activeTools: [],
  primaryColor: '#1677ff',
  opacity: 1.0,
  fontFamily: 'Segoe UI',
  textColor: null,
  apiConfigs: [],
  activeApiId: null,
  proxyType: 'none',
  proxyAddress: '',
  terminalFontFamily: 'Cascadia Code',
  terminalFontSize: 14,
  terminalBackground: '#1e1e1e',
  terminalForeground: '#d4d4d4',
  terminalCursorStyle: 'block',
  terminalShell: 'powershell.exe',
  pendingCommand: null,
  currentDirectory: null,
  activeToolId: null,

  setTheme: (theme) => {
      set({ theme });
      persistConfig(get());
  },
  setLanguage: (language) => {
      set({ language });
      persistConfig(get());
  },
  setProxyType: (proxyType) => {
      set({ proxyType });
       persistConfig(get());
  },
  setProxyAddress: (proxyAddress) => {
      set({ proxyAddress });
      persistConfig(get());
  },
  setPrimaryColor: (primaryColor) => {
      set({ primaryColor });
      persistConfig(get());
  },
  setOpacity: (opacity) => {
      set({ opacity });
      persistConfig(get());
  },
  setFontFamily: (fontFamily) => {
      set({ fontFamily });
      persistConfig(get());
  },
  setTextColor: (textColor) => {
      set({ textColor });
      persistConfig(get());
  },
  setPendingCommand: (pendingCommand) => {
      set({ pendingCommand });
  },
  setCurrentDirectory: (currentDirectory) => {
      set({ currentDirectory });
      persistConfig(get());
  },
  setActiveToolId: (activeToolId) => {
      set({ activeToolId });
      persistConfig(get());
  },
  setTerminalSettings: (settings) => {
      set((state) => ({ ...state, ...settings }));
      persistConfig(get());
  },
  addApiConfig: (config) => {
    const { apiConfigs } = get();
    const newConfigs = [...apiConfigs, config];
    set({ apiConfigs: newConfigs });
    persistConfig(get());
  },
  updateApiConfig: (config) => {
    const { apiConfigs } = get();
    const newConfigs = apiConfigs.map(c => c.id === config.id ? config : c);
    set({ apiConfigs: newConfigs });
    persistConfig(get());
  },
  removeApiConfig: (id) => {
    const { apiConfigs, activeApiId } = get();
    const newConfigs = apiConfigs.filter(c => c.id !== id);
    if (activeApiId === id) {
        set({ apiConfigs: newConfigs, activeApiId: null });
    } else {
        set({ apiConfigs: newConfigs });
    }
    persistConfig(get());
  },
  setActiveApiId: (id) => {
      set({ activeApiId: id });
      persistConfig(get());
  },
  checkEnv: async () => {
    try {
      const status = await checkEnvironment();
      set({ envStatus: status });
      persistConfig(get());
    } catch (e) {
      console.error("Failed to check environment", e);
    }
  },
  loadConfig: async () => {
      try {
          const config = await getAppConfig();
          set({
              language: config.language || 'zh',
              theme: (config.theme as 'light' | 'dark') || 'light',
              primaryColor: config.primary_color || '#1677ff',
              fontFamily: config.font_family || 'Segoe UI',
              textColor: config.text_color || null,
              terminalFontFamily: config.terminal_font_family || 'Cascadia Code',
              terminalFontSize: config.terminal_font_size || 14,
              terminalBackground: config.terminal_background || '#1e1e1e',
              terminalForeground: config.terminal_foreground || '#d4d4d4',
              terminalCursorStyle: (config.terminal_cursor_style as 'block' | 'underline' | 'bar') || 'block',
              terminalShell: config.terminal_shell || 'powershell.exe',
              apiConfigs: config.api_configs || [],
              activeApiId: config.active_api_id || null,
              proxyType: config.proxy_type || 'none',
              proxyAddress: config.proxy_address || '',
              activeTools: config.active_tools || [],
              currentDirectory: config.current_directory || null,
              activeToolId: config.active_tool_id || null,
              envStatus: config.env_status || null,
              toolStatuses: config.tool_statuses || {},
              toolConfigs: (config.tool_configs as any) || {},
              isLoaded: true
          });
      } catch (e) {
          console.error("Load config failed", e);
      }
  },
  addActiveTool: async (id) => {
      const { activeTools } = get();
      if (!activeTools.includes(id)) {
          const newTools = [...activeTools, id];
          set({ activeTools: newTools });
          persistConfig(get());
      }
  },
  removeActiveTool: async (id) => {
      const { activeTools } = get();
      const newTools = activeTools.filter(t => t !== id);
      set({ activeTools: newTools });
      persistConfig(get());
  },
  refreshTools: async (ids) => {
    try {
      // Create an array of promises where each one updates the state individually upon completion
      const checks = ids.map(async (id) => {
          try {
              const status = await checkToolStatus(id);
              set((state) => ({ 
                  toolStatuses: { ...state.toolStatuses, [status.id]: status } 
              }));
          } catch (e) {
              console.error(`Failed to check tool status: ${id}`, e);
          }
      });
      // Wait for all to finish so the caller knows when the batch is done
      await Promise.all(checks);
      persistConfig(get());
    } catch (e) {
      console.error("Failed to refresh tools batch", e);
    }
  },
  setToolStatus: (status) => {
      set((state) => ({ 
          toolStatuses: { ...state.toolStatuses, [status.id]: status } 
      }));
      persistConfig(get());
  },
  setToolConfig: (toolId, config) => {
    set((state) => {
      const current = state.toolConfigs[toolId] || { active_api_id: null, working_directory: null };
      const updated = { ...current, ...config };
      return { 
        toolConfigs: { ...state.toolConfigs, [toolId]: updated } 
      };
    });
    persistConfig(get());
  },
}));
