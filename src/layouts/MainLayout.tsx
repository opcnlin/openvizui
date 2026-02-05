import { Layout, Menu, Switch, theme, Select } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  ToolOutlined, 
  SettingOutlined, 
  CodeOutlined,
  CommentOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { useEffect, useState } from 'react';
import EnvironmentStatusInfo from '../components/EnvironmentStatusInfo';
import Logo from '../components/Logo';

const { Header, Content, Sider, Footer } = Layout;

const MainLayout = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { theme: appTheme, setTheme, opacity, language, setLanguage } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    {
      key: '/',
      icon: <ToolOutlined />,
      label: t('app.dashboard'),
    },
    {
      key: '/apps',
      icon: <AppstoreOutlined />,
      label: t('app.apps'),
    },
    {
      key: '/chat',
      icon: <CommentOutlined />,
      label: t('app.chat'),
    },
    {
      key: '/terminal',
      icon: <CodeOutlined />,
      label: t('app.terminal'),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('app.settings'),
    },
  ];

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };
  
  const { loadConfig } = useAppStore();

  useEffect(() => {
      loadConfig();
  }, []);

  useEffect(() => {
    // Apply theme to body (for simple class-based switching if needed)
    if (appTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [appTheme]);

  useEffect(() => {
      if (language && i18n.language !== language) {
          i18n.changeLanguage(language);
      }
  }, [language, i18n]);

  const handleLanguageChange = (value: string) => {
      setLanguage(value);
      i18n.changeLanguage(value);
  };

  const isDark = appTheme === 'dark';

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden', opacity: opacity }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme={isDark ? 'dark' : 'light'}
        style={{ background: token.colorBgContainer }}
        trigger={null}
      >
        <Logo collapsed={collapsed} theme={appTheme || 'light'} />
        <Menu 
          theme={isDark ? 'dark' : 'light'}
          mode="inline" 
          selectedKeys={[location.pathname]} 
          items={items} 
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
        <div onClick={() => setCollapsed(!collapsed)} style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorText
        }}>
            {collapsed ? '›' : '‹'}
        </div>
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', height: '100%', background: token.colorBgLayout }}>
        <Header style={{ 
          padding: '0 16px', 
          background: token.colorBgContainer, 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          borderBottom: isDark ? 'none' : `1px solid ${token.colorBorderSecondary}` 
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
             <Select
                 defaultValue={i18n.language}
                 value={language || i18n.language}
                 onChange={handleLanguageChange}
                 style={{ width: 100 }}
                 size="small"
                 variant="borderless"
                 options={[
                     { value: 'en', label: 'English' },
                     { value: 'zh', label: '中文' },
                 ]}
             />
             <Switch 
               checkedChildren="Dark" 
               unCheckedChildren="Light" 
               checked={isDark}
               onChange={handleThemeChange}
             />
          </div>
        </Header>
        <Content style={{ margin: '16px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', background: 'transparent', padding: '12px 16px' }}>
          <EnvironmentStatusInfo />
        </Footer>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
