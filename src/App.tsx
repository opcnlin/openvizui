import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import TerminalPage from './pages/TerminalPage';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Apps from './pages/Apps';
import { ConfigProvider, theme as antTheme } from 'antd';
import { useAppStore } from './store/appStore';

function App() {
  const { theme, primaryColor, fontFamily, textColor } = useAppStore();

  // Build theme tokens dynamically to avoid overriding defaults with undefined
  const themeTokens: any = {
    colorPrimary: primaryColor,
    fontFamily: fontFamily,
  };

  if (textColor) {
    themeTokens.colorText = textColor;
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: themeTokens,
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="apps" element={<Apps />} />
            <Route path="settings" element={<Settings />} />
            <Route path="terminal" element={<TerminalPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
