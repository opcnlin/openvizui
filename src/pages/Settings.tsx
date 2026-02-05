import { Typography, Form, Input, Select, Button, Slider, Row, Col, Card, ColorPicker, Tabs, Popconfirm, message, Divider, Radio, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { SaveOutlined, BgColorsOutlined, GlobalOutlined, CheckCircleFilled, DeleteOutlined, EditOutlined, PlusOutlined, DesktopOutlined } from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import { openUrl } from '../lib/tauri';
import { useEffect, useState } from 'react';

const { Title } = Typography;
const { Option } = Select;

const Settings = () => {
  const { t } = useTranslation();
  const { setTheme, setLanguage, primaryColor, opacity, setPrimaryColor, setOpacity, fontFamily, setFontFamily, textColor, setTextColor, proxyType, proxyAddress, setProxyType, setProxyAddress } = useAppStore();

  const fonts = [
      "Segoe UI",
      "Roboto",
      "Helvetica Neue",
      "Arial",
      "Consolas",
      "Cascadia Code",
      "Fira Code",
      "Microsoft YaHei"
  ];

  const presets = [
    { id: 'preset1', color: '#eb2f96', font: 'Segoe UI' },
    { id: 'preset2', color: '#1890ff', font: 'Roboto' },
    { id: 'preset3', color: '#52c41a', font: 'Segoe UI' },
    { id: 'preset4', color: '#722ed1', font: 'Segoe UI' },
    { id: 'preset5', color: '#faad14', font: 'Segoe UI' },
    { id: 'preset6', color: '#f5222d', font: 'Segoe UI' },
    { id: 'preset7', color: '#d4b106', font: 'Cascadia Code' },
    { id: 'preset8', color: '#595959', font: 'Fira Code' },
  ];

  const AppearanceSettings = () => (
    <Form layout="vertical">
        <Row gutter={24}>
            {/* Column 1: General */}
            <Col xs={24} md={8}>
                <Form.Item label={t('settings.language')}>
                    <Select value={useAppStore.getState().language} onChange={setLanguage}>
                        <Option value="en">English</Option>
                        <Option value="zh">中文</Option>
                    </Select>
                </Form.Item>
                <Form.Item label={t('settings.theme')}>
                    <Select value={useAppStore.getState().theme} onChange={setTheme}>
                        <Option value="light">Light</Option>
                        <Option value="dark">Dark</Option>
                    </Select>
                </Form.Item>
                <Form.Item 
                    label={t('settings.textColor')}
                    extra={t('settings.textColorDesc')}
                >
                    <ColorPicker 
                        showText 
                        allowClear
                        value={textColor || ''} 
                        onChangeComplete={(color) => setTextColor(color.toHexString())}
                        onClear={() => setTextColor('')}
                    />
                </Form.Item>
            </Col>

            {/* Column 2: Visuals */}
            <Col xs={24} md={8}>
                <Form.Item label={t('settings.systemFont')}>
                    <Select 
                        value={fontFamily} 
                        onChange={setFontFamily} 
                        showSearch
                        dropdownRender={(menu) => {
                            const [customValue, setCustomValue] = useState('');
                            return (
                                <>
                                    {menu}
                                    <Divider style={{ margin: '8px 0' }} />
                                    <div style={{ display: 'flex', gap: 8, padding: '0 8px 4px' }}>
                                        <Input 
                                            size="small"
                                            placeholder={t('settings.customFontPlaceholder')} 
                                            value={customValue}
                                            onChange={(e) => setCustomValue(e.target.value)}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                        <Button 
                                            type="text" 
                                            size="small"
                                            icon={<PlusOutlined />} 
                                            onClick={() => {
                                                if (customValue) {
                                                    setFontFamily(customValue);
                                                    setCustomValue('');
                                                }
                                            }}
                                        >
                                            {t('settings.addFont')}
                                        </Button>
                                    </div>
                                </>
                            );
                        }}
                    >
                        {fonts.map(f => <Option key={f} value={f}>{f}</Option>)}
                        {!fonts.includes(fontFamily) && <Option value={fontFamily}>{fontFamily}</Option>}
                    </Select>
                </Form.Item>
                <Form.Item label={t('settings.primaryColor')}>
                    <ColorPicker 
                        showText 
                        value={primaryColor} 
                        onChangeComplete={(color) => setPrimaryColor(color.toHexString())} 
                    />
                </Form.Item>
                <Form.Item label={t('settings.windowOpacity')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Slider 
                            style={{ flex: 1 }}
                            min={0.1} 
                            max={1.0} 
                            step={0.05} 
                            value={opacity} 
                            onChange={(val) => setOpacity(val)} 
                        />
                        <Typography.Text style={{ width: 40 }}>{Math.round(opacity * 100)}%</Typography.Text>
                    </div>
                </Form.Item>
            </Col>

            {/* Column 3: Presets */}
            <Col xs={24} md={8}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                    {t('settings.appearancePresets')}
                </Typography.Text>
                <Row gutter={[8, 8]}>
                    {presets.map(p => (
                        <Col span={12} key={p.id}>
                            <Card 
                                size="small"
                                hoverable
                                styles={{ body: { padding: '8px' } }}
                                style={{ 
                                    border: primaryColor === p.color ? `2px solid ${primaryColor}` : '1px solid #f0f0f0',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setPrimaryColor(p.color);
                                    setFontFamily(p.font);
                                    message.success(`${t('settings.' + p.id)} ${t('settings.applyPreset')}`);
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                                    <div style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {t('settings.' + p.id)}
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Col>
        </Row>
    </Form>
  );

  const TerminalSettings = () => {
    const { t } = useTranslation();
    const { 
        terminalFontFamily, 
        terminalFontSize, 
        terminalBackground, 
        terminalForeground, 
        terminalCursorStyle,
        terminalShell,
        setTerminalSettings,
        primaryColor
    } = useAppStore();

    const terminalPresets = [
        { name: 'Default Dark', bg: '#1e1e1e', fg: '#d4d4d4' },
        { name: 'One Dark', bg: '#282c34', fg: '#abb2bf' },
        { name: 'Dracula', bg: '#282a36', fg: '#f8f8f2' },
        { name: 'Monokai', bg: '#272822', fg: '#f8f8f2' },
        { name: 'Nord', bg: '#2e3440', fg: '#d8dee9' },
        { name: 'Solarized Dark', bg: '#002b36', fg: '#839496' }
    ];

    const terminalFonts = ['Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Ubuntu Mono', 'monospace'];

    return (
        <Form layout="vertical">
            <Row gutter={24}>
                <Col xs={24} md={8}>
                    <Card title={t('settings.terminalFont')} size="small" styles={{ body: { padding: 16 } }}>
                        <Form.Item label={t('settings.fontFamily')}>
                            <Select 
                                value={terminalFontFamily} 
                                onChange={(val) => setTerminalSettings({ terminalFontFamily: val })}
                                dropdownRender={(menu) => (
                                    <>
                                        {menu}
                                        <Divider style={{ margin: '4px 0' }} />
                                        <div style={{ display: 'flex', gap: 8, padding: '4px 8px' }}>
                                            <Input size="small" placeholder="Custom Font" onPressEnter={(e) => {
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val) setTerminalSettings({ terminalFontFamily: val });
                                            }} />
                                        </div>
                                    </>
                                )}
                            >
                                {terminalFonts.map(f => <Option key={f} value={f}>{f}</Option>)}
                                {!terminalFonts.includes(terminalFontFamily) && <Option value={terminalFontFamily}>{terminalFontFamily}</Option>}
                            </Select>
                        </Form.Item>
                        <Form.Item label={t('settings.fontSize')}>
                            <InputNumber 
                                min={8} max={72} 
                                value={terminalFontSize} 
                                onChange={(val) => setTerminalSettings({ terminalFontSize: val || 14 })}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                        <Form.Item label={t('settings.cursorStyle')}>
                            <Radio.Group 
                                value={terminalCursorStyle} 
                                onChange={(e) => setTerminalSettings({ terminalCursorStyle: e.target.value })}
                            >
                                <Radio.Button value="block">Block</Radio.Button>
                                <Radio.Button value="underline">Underline</Radio.Button>
                                <Radio.Button value="bar">Bar</Radio.Button>
                            </Radio.Group>
                        </Form.Item>
                        <Form.Item label={t('settings.terminalShell')}>
                            <Select 
                                value={terminalShell} 
                                onChange={(val) => setTerminalSettings({ terminalShell: val })}
                                dropdownRender={(menu) => (
                                    <>
                                        {menu}
                                        <Divider style={{ margin: '4px 0' }} />
                                        <div style={{ display: 'flex', gap: 8, padding: '4px 8px' }}>
                                            <Input size="small" placeholder="Custom Path (e.g. C:\Program Files\Git\bin\bash.exe)" onPressEnter={(e) => {
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val) setTerminalSettings({ terminalShell: val });
                                            }} />
                                        </div>
                                    </>
                                )}
                            >
                                <Option value="bash.exe">Git Bash (Default)</Option>
                                <Option value="wsl">WSL (Linux)</Option>
                                {!['wsl', 'bash.exe'].includes(terminalShell) && (
                                    <Option value={terminalShell}>{terminalShell}</Option>
                                )}
                            </Select>
                        </Form.Item>
                    </Card>
                </Col>

                <Col xs={24} md={8}>
                    <Card title={t('settings.terminalColors')} size="small" styles={{ body: { padding: 16 } }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Form.Item label={t('settings.terminalBackground')} style={{ marginBottom: 0 }}>
                                <ColorPicker 
                                    value={terminalBackground} 
                                    onChange={(color) => setTerminalSettings({ terminalBackground: color.toHexString() })} 
                                    showText
                                />
                            </Form.Item>
                            <Form.Item label={t('settings.terminalForeground')} style={{ marginBottom: 0 }}>
                                <ColorPicker 
                                    value={terminalForeground} 
                                    onChange={(color) => setTerminalSettings({ terminalForeground: color.toHexString() })} 
                                    showText
                                />
                            </Form.Item>
                        </div>
                        <div style={{ 
                            marginTop: 16, 
                            padding: 12, 
                            background: terminalBackground, 
                            color: terminalForeground, 
                            borderRadius: 4,
                            fontFamily: terminalFontFamily,
                            fontSize: terminalFontSize,
                            border: '1px solid #444',
                            minHeight: 80
                        }}>
                            $ echo "Welcome to OpenVizUI!"<br/>
                            $ preview rendering...<span style={{ 
                                display: 'inline-block', 
                                width: 8, 
                                height: 16, 
                                background: terminalForeground,
                                verticalAlign: 'middle',
                                marginLeft: 4,
                                animation: 'blink 1s step-end infinite'
                            }} />
                            <style>{`
                                @keyframes blink {
                                    0%, 100% { opacity: 1; }
                                    50% { opacity: 0; }
                                }
                            `}</style>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={8}>
                    <Card title={t('settings.terminalPresets')} size="small" styles={{ body: { padding: 16 } }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {terminalPresets.map(p => (
                                <Card 
                                    key={p.name}
                                    hoverable
                                    size="small"
                                    onClick={() => setTerminalSettings({
                                        terminalBackground: p.bg,
                                        terminalForeground: p.fg
                                    })}
                                    style={{ 
                                        padding: 0, 
                                        overflow: 'hidden',
                                        border: terminalBackground === p.bg ? `2px solid ${primaryColor}` : '1px solid #f0f0f0'
                                    }}
                                    styles={{ body: { padding: 8 } }}
                                >
                                    <div style={{ fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{p.name}</div>
                                    <div style={{ height: 20, background: p.bg, border: '1px solid #444', borderRadius: 2, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: p.fg }} />
                                        <div style={{ marginLeft: 4, width: 20, height: 2, background: p.fg, opacity: 0.5 }} />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </Card>
                </Col>
            </Row>
        </Form>
    );
  };

  const NetworkSettings = () => {
      const [editingId, setEditingId] = useState<string | null>(null);
      const { apiConfigs, activeApiId, addApiConfig, updateApiConfig, removeApiConfig, setActiveApiId } = useAppStore();
      const [apiForm] = Form.useForm();
      const { t } = useTranslation();

      const handleCancelEdit = () => {
        setEditingId(null);
        apiForm.resetFields();
        apiForm.setFieldsValue({
            auth_type: 'api_key',
            base_url: 'https://api.openai.com/v1'
        });
      };

      // Initialize default values on mount
      useEffect(() => {
          handleCancelEdit();
      }, []);

      const handleEdit = (config: any) => {
          setEditingId(config.id);
          apiForm.setFieldsValue(config);
      };

      const changeActiveApi = (id: string) => {
           setActiveApiId(id);
           message.success('Switched active configuration');
      };

      const deleteApi = (id: string, e: React.MouseEvent) => {
          e.stopPropagation();
          if (activeApiId === id) {
              message.warning('Cannot delete active configuration');
              return;
          }
          removeApiConfig(id);
          message.success('Configuration deleted');
          if (editingId === id) {
              handleCancelEdit();
          }
      };

      const saveApiConfig = async () => {
          try {
              const values = await apiForm.validateFields();
              const newConfig = {
                  id: editingId || crypto.randomUUID(),
                  name: values.name,
                  auth_type: values.auth_type,
                  base_url: values.base_url || null,
                  api_key: values.api_key || null,
                  model: values.model || null
              };

              if (editingId) {
                  updateApiConfig(newConfig);
                  message.success('Configuration updated');
              } else {
                  addApiConfig(newConfig);
                  // If it's the first one, make it active
                  if (apiConfigs.length === 0) {
                      setActiveApiId(newConfig.id);
                  }
                  message.success('Configuration added');
              }
              handleCancelEdit();
          } catch (e) {
              // validation failed
          }
      };

      return (
        <Row gutter={[16, 16]}>
          {/* Column 1: API Config List */}
          <Col xs={24} md={7}>
            <Card title={t('settings.apiList')} size="small" styles={{ body: { padding: '12px' } }} style={{ height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {apiConfigs.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>
                          No configurations yet.
                      </div>
                  )}
                  {apiConfigs.map(config => (
                      <Card 
                          key={config.id} 
                          size="small"
                          hoverable
                          onClick={() => changeActiveApi(config.id)}
                          styles={{ body: { padding: '8px 12px' } }}
                          style={{ 
                              border: activeApiId === config.id ? `1px solid ${primaryColor}` : '1px solid #f0f0f0',
                              background: activeApiId === config.id ? `${primaryColor}0a` : undefined 
                          }}
                      >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                  {activeApiId === config.id && 
                                      <CheckCircleFilled style={{ color: primaryColor, fontSize: 16, flexShrink: 0 }} />
                                  }
                                  <div style={{ overflow: 'hidden' }}>
                                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{config.name}</div>
                                      <div style={{ fontSize: 11, color: 'gray', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {config.model}
                                      </div>
                                  </div>
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <Button 
                                      size="small" 
                                      type="text"
                                      icon={<EditOutlined style={{ fontSize: 12 }} />} 
                                      onClick={(e) => { e.stopPropagation(); handleEdit(config); }}
                                  />
                                  <Popconfirm 
                                      title={t('settings.deleteConfirm')} 
                                      onConfirm={(e) => deleteApi(config.id, e as React.MouseEvent)}
                                      onCancel={(e) => e?.stopPropagation()}
                                      okText="Yes"
                                      cancelText="No"
                                  >
                                      <Button 
                                          size="small" 
                                          type="text"
                                          danger 
                                          icon={<DeleteOutlined style={{ fontSize: 12 }} />} 
                                          onClick={(e) => e.stopPropagation()}
                                          disabled={activeApiId === config.id}
                                      />
                                  </Popconfirm>
                              </div>
                          </div>
                      </Card>
                  ))}
              </div>
            </Card>
          </Col>

          {/* Column 2: Add/Edit Form */}
          <Col xs={24} md={10}>
            <Card title={editingId ? t('settings.editApi') : t('settings.addApi')} size="small" style={{ height: '100%' }}>
                <Form form={apiForm} layout="vertical" onFinish={saveApiConfig}>
                      <Form.Item 
                          label={t('settings.configName')} 
                          name="name" 
                          rules={[{ required: true, message: 'Please enter a name' }]}
                      >
                          <Input placeholder="e.g. My OpenAI" />
                      </Form.Item>

                      <Row gutter={8}>
                          <Col span={12}>
                            <Form.Item label={t('settings.authType')} name="auth_type">
                                <Select>
                                    <Option value="api_key">API Key</Option>
                                    <Option value="oauth">OAuth 2.0</Option>
                                </Select>
                            </Form.Item>
                          </Col>
                           <Col span={12}>
                            <Form.Item label={t('settings.modelName')} name="model">
                                <Input placeholder="gpt-4o" />
                            </Form.Item>
                          </Col>
                      </Row>

                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.auth_type !== curr.auth_type}>
                        {({ getFieldValue }) => {
                            const authType = getFieldValue('auth_type');
                            return authType === 'oauth' ? (
                                <Form.Item label={t('settings.provider')} name="provider_mock">
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                         <Select defaultValue="github">
                                             <Option value="github">GitHub</Option>
                                             <Option value="google">Google</Option>
                                         </Select>
                                         <Button 
                                              icon={<GlobalOutlined />} 
                                              block
                                              onClick={async () => {
                                                  const provider = apiForm.getFieldValue('provider_mock') || 'github';
                                                  const url = provider === 'github' ? 'https://github.com/login/oauth/authorize' : 'https://accounts.google.com/o/oauth2/auth';
                                                  
                                                  const hide = message.loading(t('settings.loggingIn'), 0);
                                                  
                                                  try {
                                                      await openUrl(url);
                                                  } catch (e) {
                                                      message.error('Failed to open browser');
                                                  }
                                                  
                                                  setTimeout(() => {
                                                      hide();
                                                      message.success(t('settings.loginSuccess'));
                                                      apiForm.setFieldsValue({ api_key: 'oauth_token_mock_' + Date.now() });
                                                  }, 2000);
                                              }}
                                         >
                                             {t('settings.login')}
                                         </Button>
                                         <Form.Item name="api_key" hidden><Input /></Form.Item>
                                     </div>
                                </Form.Item>
                            ) : (
                                <>
                                  <Form.Item label={t('settings.baseUrl')} name="base_url">
                                      <Input placeholder="https://api.openai.com/v1" />
                                  </Form.Item>
                                  <Form.Item label={t('settings.apiKey')} name="api_key">
                                      <Input.Password placeholder="sk-..." />
                                  </Form.Item>
                                </>
                            );
                        }}
                    </Form.Item>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                        {editingId && (
                            <Button onClick={handleCancelEdit} size="small">
                                Cancel
                            </Button>
                        )}
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="small">
                            {editingId ? 'Update' : 'Add'}
                        </Button>
                    </div>
                </Form>
            </Card>
          </Col>

          {/* Column 3: Proxy Settings */}
          <Col xs={24} md={7}>
            <Card title={<span><GlobalOutlined /> {t('settings.proxySettings')}</span>} size="small" style={{ height: '100%' }}>
              <Form layout="vertical">
                <Form.Item label={t('settings.proxyType')}>
                    <Select value={proxyType} onChange={setProxyType}>
                        <Option value="none">{t('settings.noProxy')}</Option>
                        <Option value="http">HTTP/HTTPS</Option>
                        <Option value="socks5">SOCKS5</Option>
                    </Select>
                </Form.Item>

                {proxyType !== 'none' && (
                    <Form.Item label={t('settings.proxyAddress')}>
                        <Input 
                            placeholder="127.0.0.1:7890" 
                            value={proxyAddress} 
                            onChange={(e) => setProxyAddress(e.target.value)}
                            onBlur={() => message.success('Proxy address saved')}
                        />
                    </Form.Item>
                )}
              </Form>
            </Card>
          </Col>
        </Row>
      );
  };

  return (
    <div style={{ margin: '0 auto', width: '100%' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <Title level={2}>{t('app.settings')}</Title>
      </div>
      
      <Tabs
        defaultActiveKey="system"
        centered={false}
        items={[
            {
                key: 'system',
                label: <span style={{ padding: '0 24px' }}><BgColorsOutlined /> {t('settings.systemAppearance')}</span>,
                children: (
                    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
                        <Card bordered={false}><AppearanceSettings /></Card>
                    </div>
                )
            },
            {
                key: 'network',
                label: <span style={{ padding: '0 24px' }}><GlobalOutlined /> {t('settings.networkApi')}</span>,
                children: (
                    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px' }}>
                        <Card bordered={false}><NetworkSettings /></Card>
                    </div>
                )
            },
            {
                key: 'terminal',
                label: <span style={{ padding: '0 24px' }}><DesktopOutlined /> {t('settings.terminal')}</span>,
                children: (
                    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px' }}>
                        <Card bordered={false}><TerminalSettings /></Card>
                    </div>
                )
            }
        ]}
      />
    </div>
  );
};

export default Settings;
