import { Card, Button, Row, Col, Tag, Typography, message, Modal, Select, Space, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReloadOutlined, PlusOutlined, ConsoleSqlOutlined } from '@ant-design/icons';
import { installTool, uninstallTool, checkToolStatus, updateTool } from '../lib/tauri';
import { useEffect, useState } from 'react';

import { useAppStore } from '../store/appStore';

const { Title } = Typography;
const { Option } = Select;

interface ToolItem {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toolStatuses, activeTools, refreshTools, addActiveTool, removeActiveTool, setToolStatus } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [uninstalling, setUninstalling] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedToolToAdd, setSelectedToolToAdd] = useState<string | null>(null);
  const [addingTool, setAddingTool] = useState(false);

  const ToolIcon = ({ name, color }: { id: string, name: string, color: string }) => {
    return (
      <div style={{ 
        width: 36, 
        height: 36, 
        borderRadius: '10px', 
        background: `linear-gradient(135deg, ${color}20, ${color}08)`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: `1.5px solid ${color}40`,
        color: color,
        fontSize: '20px',
        fontWeight: '700',
        flexShrink: 0,
        boxShadow: `0 2px 8px ${color}15`,
        textShadow: `0 0 10px ${color}30`
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const toolDefs: ToolItem[] = [
    {
      id: 'claude',
      name: t('tools.claude'),
      icon: <ToolIcon id="claude" name="Claude" color="#D97757" />
    },
    {
      id: 'google',
      name: t('tools.google'),
      icon: <ToolIcon id="google" name="Google" color="#4285F4" />
    },
    {
      id: 'opencode',
      name: t('tools.opencode'),
      icon: <ToolIcon id="opencode" name="OpenCode" color="#0EA5E9" />
    },
    {
      id: 'openclaw',
      name: t('tools.openclaw'),
      icon: <ToolIcon id="openclaw" name="OpenClaw" color="#22C55E" />
    },
    {
      id: 'iflow',
      name: t('tools.iflow'),
      icon: <ToolIcon id="iflow" name="iFlow" color="#8B5CF6" />
    },
    {
      id: 'codebuddy',
      name: t('tools.codebuddy'),
      icon: <ToolIcon id="codebuddy" name="CodeBuddy" color="#F59E0B" />
    },
    {
      id: 'copilot',
      name: t('tools.copilot'),
      icon: <ToolIcon id="copilot" name="Copilot" color="#6366F1" />
    },
    {
      id: 'codex',
      name: t('tools.codex'),
      icon: <ToolIcon id="codex" name="Codex" color="#14B8A6" />
    },
    {
      id: 'kilocode',
      name: t('tools.kilocode'),
      icon: <ToolIcon id="kilocode" name="KiloCode" color="#EC4899" />
    },
    {
      id: 'grok',
      name: t('tools.grok'),
      icon: <ToolIcon id="grok" name="Grok" color="#84CC16" />
    }
  ];

  // When activeTools changes, refresh their status
  // Only auto-refresh if we don't have statuses for them yet (e.g. initial load)
  useEffect(() => {
    const checkMissing = () => {
      if (activeTools.length > 0) {
          const missingStatuses = activeTools.some(id => !toolStatuses[id]);
          if (missingStatuses) {
              handleRefresh();
          }
      }
    };
    checkMissing();
  }, [activeTools]); // Removed toolStatuses from deps to prevent infinite loops if status changes

  const handleRefresh = async () => {
      if (activeTools.length === 0) return;
      setRefreshing(true);
      await refreshTools(activeTools);
      setRefreshing(false);
  };

  const handleAddTool = async () => {
      if (!selectedToolToAdd) return;
      setAddingTool(true);
      const toolId = selectedToolToAdd;
      
      try {
          message.loading({ content: `Checking ${toolId}...`, key: 'add_tool', duration: 0 });
          // 1. Check if already installed
          const status = await checkToolStatus(toolId);
          
          if (status.installed) {
              message.success({ content: `${toolId} is already installed. Adding to workbench.`, key: 'add_tool' });
              setToolStatus(status);
              await addActiveTool(toolId);
          } else {
              // 2. Not installed, try to install
               message.loading({ content: `Installing ${toolId}...`, key: 'add_tool', duration: 0 });
               await installTool(toolId);
               // 3. Verify and Add
               const newStatus = await checkToolStatus(toolId);
               if (newStatus.installed) {
                   setToolStatus(newStatus);
                   await addActiveTool(toolId);
                   message.success({ content: `Installed and added ${toolId}`, key: 'add_tool' });
               } else {
                   throw new Error("Installation verified failed");
               }
          }
          setIsModalOpen(false);
          setSelectedToolToAdd(null);
      } catch (e) {
          message.error({ content: `Failed to add ${toolId}: ${e}`, key: 'add_tool' });
      } finally {
          setAddingTool(false);
      }
  };

  const handleUninstall = async (toolId: string) => {
      setUninstalling(prev => ({ ...prev, [toolId]: true }));
      setProcessing(prev => ({ ...prev, [toolId]: true }));
      try {
          message.loading({ content: `Uninstalling ${toolId}...`, key: 'uninstall', duration: 0 });
          await uninstallTool(toolId);
          await removeActiveTool(toolId); // Remove from workbench
          message.success({ content: "Uninstalled and removed from workbench", key: 'uninstall' });
      } catch (e) {
          message.error({ content: `Failed to uninstall ${toolId}`, key: 'uninstall' });
      } finally {
          setUninstalling(prev => ({ ...prev, [toolId]: false }));
          setProcessing(prev => ({ ...prev, [toolId]: false }));
      }
  }

   const handleConfig = (toolId: string) => {
      message.info(`Configuration for ${toolId} coming soon.`);
  }

  const handleUpdate = async (toolId: string) => {
    setUpdating(prev => ({ ...prev, [toolId]: true }));
    setProcessing(prev => ({ ...prev, [toolId]: true }));
    try {
        message.loading({ content: `Updating ${toolId}...`, key: 'update', duration: 0 });
        await updateTool(toolId);
        await refreshTools([toolId]);
        message.success({ content: `${toolId} updated successfully`, key: 'update' });
    } catch (e) {
        message.error({ content: `Failed to update ${toolId}: ${e}`, key: 'update' });
    } finally {
        setUpdating(prev => ({ ...prev, [toolId]: false }));
        setProcessing(prev => ({ ...prev, [toolId]: false }));
    }
  }

  const handleRunInChat = (toolId: string) => {
    // setActiveToolId is handled in store, ensuring Chat picks it up
    // We can also set it explicitly here if needed, but store should handle it via UI interaction if we sync it
    // Actually, we need to set the active tool in the store so Chat knows what to launch
    useAppStore.getState().setActiveToolId(toolId);
    navigate('/chat');
  };

  // Filter tools to display
  const toolsToDisplay = toolDefs
      .filter(def => activeTools.includes(def.id))
      .map(def => {
          const status = toolStatuses[def.id];
          return {
              ...def,
              status: status?.installed ? 'installed' : 'not_installed', // Should mostly be installed
              version: status?.version || '-'
          };
      });
  
  const availableToolsToAdd = toolDefs.filter(t => !activeTools.includes(t.id));

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>{t('app.dashboard')}</Title>
        <Space>
            <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh} 
                loading={refreshing}
            >
                {t('app.refresh')}
            </Button>
            <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => setIsModalOpen(true)}
                style={{ borderRadius: '8px', fontWeight: 500 }}
            >
                {t('app.addTool')}
            </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]} style={{ margin: 0 }}>
        {toolsToDisplay.map((tool) => (
          <Col xs={24} sm={12} md={8} lg={6} key={tool.id}>
            <Card 
              title={tool.name} 
              extra={tool.icon}
              actions={[
                 <Tooltip title="Run in Chat">
                    <Button 
                        type="text" 
                        icon={<ConsoleSqlOutlined />} 
                        disabled={processing[tool.id] || tool.status !== 'installed'} 
                        onClick={() => handleRunInChat(tool.id)}
                    />
                 </Tooltip>,
                   <Button type="text" onClick={() => handleConfig(tool.id)} disabled={processing[tool.id]}>{t('app.config')}</Button>,
                  <Button 
                    type="text" 
                    onClick={() => handleUpdate(tool.id)} 
                    loading={updating[tool.id]} 
                    disabled={processing[tool.id] || tool.status !== 'installed'}
                  >
                    {t('app.update')}
                  </Button>,
                  <Button 
                    type="text" 
                    danger 
                    loading={uninstalling[tool.id]} 
                    onClick={() => handleUninstall(tool.id)}
                    disabled={processing[tool.id]}
                  >
                    {t('app.uninstall')}
                  </Button>
               ]}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                 <span>Status:</span>
                 <Tag color={tool.status === 'installed' ? 'success' : 'red'}>
                    {tool.status === 'installed' ? 'Installed' : 'Error'}
                 </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <span>Version:</span>
                 <span>{tool.version}</span>
              </div>
            </Card>
          </Col>
        ))}
        {toolsToDisplay.length === 0 && (
            <Col span={24}>
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No active tools. Click "Add Tool" to get started.
                </div>
            </Col>
        )}
      </Row>

      <Modal 
        title="Add CLI Tool" 
        open={isModalOpen} 
        onCancel={() => !addingTool && setIsModalOpen(false)}
        footer={[
            <Button key="cancel" disabled={addingTool} onClick={() => setIsModalOpen(false)}>Cancel</Button>,
            <Button key="add" type="primary" loading={addingTool} disabled={!selectedToolToAdd} onClick={handleAddTool}>
                Add & Install
            </Button>
        ]}
      >
          <p>Select a tool to add to your workbench. If it's not installed, we will check and install it for you.</p>
          <Select 
            style={{ width: '100%' }} 
            placeholder="Select a tool"
            onChange={setSelectedToolToAdd}
            value={selectedToolToAdd}
          >
              {availableToolsToAdd.map(t => (
                  <Option key={t.id} value={t.id}>{t.name}</Option>
              ))}
          </Select>
      </Modal>
    </div>
  );
};

export default Dashboard;
