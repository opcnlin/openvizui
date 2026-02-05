import { useState, useRef, useEffect, useCallback } from 'react';
import { Layout, Input, Button, List, Avatar, Typography, Space, theme, Tooltip, Tree, Select, Spin, Collapse, Dropdown, Modal } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, LoadingOutlined, ClearOutlined, FolderOutlined, CodeOutlined, CopyOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import { useTranslation } from 'react-i18next';
import { ptyOpen, ptyWrite, ptyClose, fetchRemoteModels } from '../lib/tauri';
import { listen } from '@tauri-apps/api/event';
import Ansi from 'ansi-to-react';
import stripAnsi from 'strip-ansi'; 
import { readDir, rename, remove } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { DataNode } from 'antd/es/tree';
import { message } from 'antd';

const { Content, Sider } = Layout;
const { Text } = Typography;
const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  blocks?: any[];
}

const TOOL_COMMANDS: Record<string, string> = {
  iflow: 'iflow',
  google: 'gemini',
  claude: 'claude',
  openclaw: 'openclaw',
  opencode: 'opencode',
  codebuddy: 'codebuddy',
  copilot: 'copilot',
  codex: 'codex',
  kilocode: 'kilocode',
  grok: 'grok',
};

const Chat = () => {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const { 
    apiConfigs, 
    activeApiId, 
    setActiveApiId, 
    updateApiConfig,
    activeToolId, 
    setActiveToolId,
    activeTools, 
    toolStatuses, 
    currentDirectory,
    setCurrentDirectory
  } = useAppStore();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const outputBufferRef = useRef('');
  const lineBufferRef = useRef('');
  const responseIdRef = useRef<string | null>(null);
  const isStructuredTurnRef = useRef(false);
  const ptyInitTimeoutRef = useRef<any>(null);
  
  const [siderWidth, setSiderWidth] = useState(280);
  const isResizing = useRef(false);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX;
    if (newWidth > 200 && newWidth < 600) {
      setSiderWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    const handleMouseUp = () => stopResizing();
    const handleMove = (e: MouseEvent) => handleMouseMove(e);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, stopResizing]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const [isFetchingModels, setIsFetchingModels] = useState(false);
  
  const handleFetchModels = async () => {
       const config = apiConfigs.find(c => c.id === activeApiId);
       if (!config) {
           message.error("Please select a configuration first");
           return;
       }
       setIsFetchingModels(true);
       try {
           const models = await fetchRemoteModels(config.base_url!, config.api_key!);
           updateApiConfig({ ...config, models });
           message.success(`Found ${models.length} models`);
       } catch (e) {
           console.error(e);
           message.error("Failed to fetch models");
       } finally {
           setIsFetchingModels(false);
       }
  };

  const handleModelSelect = (val: string) => {
      const config = apiConfigs.find(c => c.id === activeApiId);
      if (config) updateApiConfig({ ...config, model: val });
  };

  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  const updateTreeData = (list: DataNode[], key: React.Key, children: DataNode[]): DataNode[] =>
    list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });

  const loadTree = async (dir: string): Promise<DataNode[]> => {
    const entries = await readDir(dir);
    return entries
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({
        title: entry.name,
        key: `${dir}/${entry.name}`,
        isLeaf: !entry.isDirectory,
      }));
  };

  useEffect(() => {
    if (currentDirectory) {
      setLoadingTree(true);
      loadTree(currentDirectory).then(data => {
        setTreeData(data);
        setLoadingTree(false);
      });
    }
  }, [currentDirectory]);

  const onLoadData = ({ key, children }: any) =>
    new Promise<void>(async (resolve) => {
      if (children) {
        resolve();
        return;
      }
      const newNodes = await loadTree(key as string);
      setTreeData((origin) => updateTreeData(origin, key, newNodes));
      resolve();
    });

  const handleSelectDirectory = async () => {
    try {
        const selected = await openDialog({
            directory: true,
            multiple: false,
        });
        if (selected && typeof selected === 'string') setCurrentDirectory(selected);
    } catch (e) {
        console.error(e);
    }
  };

  const handleInsertPath = (path: string) => {
    // Normalize path to use forward slashes for consistency
    const normalized = path.replace(/\\/g, '/');
    setInputValue(prev => {
      const space = (prev && !prev.endsWith(' ')) ? ' ' : '';
      return prev + space + normalized;
    });
    message.info(t('chat.path_inserted') || 'Path inserted');
  };

  const handleCopyPath = (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    navigator.clipboard.writeText(normalized);
    message.success(t('chat.path_copied') || 'Path copied');
  };

  const handleClear = () => {
    setMessages([]);
    outputBufferRef.current = '';
    ptyWrite('clear\r'); 
  };

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [targetNode, setTargetNode] = useState<{ key: string, title: string } | null>(null);
  const [newName, setNewName] = useState('');

  const handleRename = async () => {
    if (!targetNode || !newName.trim()) return;
    try {
        const oldPath = targetNode.key;
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${parentDir}/${newName.trim()}`;
        
        await rename(oldPath, newPath);
        message.success(t('chat.rename_success'));
        setRenameModalVisible(false);
        // Refresh tree
        if (currentDirectory) {
            const data = await loadTree(currentDirectory);
            setTreeData(data);
        }
    } catch (e) {
        console.error(e);
        message.error(t('chat.rename_failed'));
    }
  };

  const handleDelete = async (path: string) => {
    Modal.confirm({
        title: t('chat.delete_confirm_title'),
        icon: <InfoCircleOutlined style={{ color: '#ff4d4f' }} />,
        content: t('chat.delete_confirm_content'),
        okText: t('chat.delete_ok'),
        okType: 'danger',
        cancelText: t('chat.cancel'),
        onOk: async () => {
            try {
                await remove(path, { recursive: true });
                message.success(t('chat.delete_success'));
                if (currentDirectory) {
                    const data = await loadTree(currentDirectory);
                    setTreeData(data);
                }
            } catch (e) {
                console.error(e);
                message.error(t('chat.delete_failed'));
            }
        }
    });
  };

  const cleanAnsiForDisplay = (str: string) => {
      return str
        .replace(/\u001b\][0-9]*;.*?(?:\u0007|\u001b\\)/g, '') 
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/g, ''); 
  };

  const handleRawOutput = useCallback((clean: string) => {
    if (activeToolId && activeToolId !== 'bash') {
        if (isStructuredTurnRef.current) return;
        // Relaxed filtering to allow potential error messages or short prompts
        const stripped = stripAnsi(clean).trim();
        // Allow command echos (starting with > or $) or short text if it looks like content
        if ((!stripped || stripped === '>' || stripped === '$') && clean.length < 5) return; 
    }

    outputBufferRef.current += clean;
    setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.isStreaming) {
            let cleanContent = outputBufferRef.current.replace(/^> /, '').trimStart();
            return [...prev.slice(0, -1), { ...last, content: cleanContent }];
        } else if (!last || last.role === 'user') {
            outputBufferRef.current = clean;
            return [...prev, { id: Date.now().toString(), role: 'assistant', content: clean, timestamp: Date.now(), isStreaming: true }];
        }
        return prev;
    });
  }, [activeToolId]);

  const handleJsonEvent = useCallback((data: any) => {
      if (data.type === 'message' || data.type === 'assistant' || data.content || data.text) {
          isStructuredTurnRef.current = true;
      }
      if (data.type === 'message' || data.type === 'assistant') {
          const contentBlocks = data.message?.content || data.content || [];
          setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.isStreaming) {
                  const newBlocks = [...(last.blocks || [])];
                  let newContent = last.content;
                  contentBlocks.forEach((block: any) => {
                      if (block.type === 'text' && block.text) newContent += block.text;
                      else newBlocks.push(block);
                  });
                  return [...prev.slice(0, -1), { ...last, blocks: newBlocks, content: newContent }];
              } else {
                  let initialContent = '';
                  const blocks: any[] = [];
                  contentBlocks.forEach((block: any) => {
                      if (block.type === 'text') initialContent += block.text;
                      else blocks.push(block);
                  });
                  return [...prev, { id: Date.now().toString(), role: 'assistant', content: initialContent, blocks, timestamp: Date.now(), isStreaming: true }];
              }
          });
      } else if (data.type === 'result') {
          setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant' && last.isStreaming) {
                  return [...prev.slice(0, -1), { ...last, isStreaming: false }];
              }
              return prev;
          });
      }
  }, []);

  const initChatPty = useCallback(async () => {
    try {
        await ptyClose();
        await ptyOpen(140, 40);         if (activeToolId) {
             const cmd = TOOL_COMMANDS[activeToolId] || activeToolId;
             
             if (ptyInitTimeoutRef.current) clearTimeout(ptyInitTimeoutRef.current);
             ptyInitTimeoutRef.current = setTimeout(() => {
                 ptyWrite(`${cmd}\r`);
                 // Feedback in chat so user knows command was sent
                 setMessages(prev => [...prev, { 
                     id: Date.now().toString(), 
                     role: 'assistant', 
                     content: `> Executing: \`${cmd}\`\n`, 
                     timestamp: Date.now() 
                 }]);
             }, 800);
        }
    } catch (e) {
        console.error(e);
    }
  }, [activeToolId]);

  // Handle activeToolId change to reset buffers and show system message
  useEffect(() => {
     outputBufferRef.current = '';
     isStructuredTurnRef.current = false;
     if (activeToolId) {
         setMessages(prev => [
             ...prev, 
             { 
                 id: Date.now().toString(), 
                 role: 'assistant', 
                 content: `\n> *System: Switched to tool ${activeToolId}\n`, 
                 timestamp: Date.now() 
             }
         ]);
     }
  }, [activeToolId]);

  useEffect(() => {
    let unlisten: any;
    const run = async () => {
        unlisten = await listen<string>('pty-data', (event) => {
            lineBufferRef.current += event.payload;
            const lines = lineBufferRef.current.split(/\r?\n/);
            lineBufferRef.current = lines.pop() || '';
            lines.forEach(line => {
                if (!line.trim()) return;
                try {
                    handleJsonEvent(JSON.parse(line));
                } catch {
                    const clean = cleanAnsiForDisplay(line);
                    if (stripAnsi(clean).trim() || clean.length >= 10) handleRawOutput(clean);
                }
            });
        });
    };
    run();
    initChatPty();
    return () => {
        if (unlisten) unlisten();
        if (ptyInitTimeoutRef.current) clearTimeout(ptyInitTimeoutRef.current);
        ptyClose();
    };
  }, [initChatPty, handleJsonEvent, handleRawOutput]);

  const sendMessage = () => {
    if (!inputValue.trim()) return;
    isStructuredTurnRef.current = false;
    const newMessage: Message = { id: Date.now().toString(), role: 'user', content: inputValue, timestamp: Date.now() };
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m).concat(newMessage));
    outputBufferRef.current = '';
    responseIdRef.current = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: responseIdRef.current!, role: 'assistant', content: '...', timestamp: Date.now(), isStreaming: true }]);
    setInputValue('');
    ptyWrite(`${inputValue}\r`);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={siderWidth} style={{ background: token.colorBgContainer, marginRight: 16, borderRadius: token.borderRadiusLG, padding: '16px 10px', position: 'relative' }}>
        <div onMouseDown={startResizing} style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: 16, cursor: 'col-resize', zIndex: 10, background: 'transparent' }} />
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
             <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button icon={<FolderOutlined />} onClick={handleSelectDirectory} size="small">
                     {currentDirectory ? t('chat.change_dir') : t('chat.select_dir')}
                  </Button>
                  {currentDirectory && (
                     <Text ellipsis style={{ fontSize: 11, flex: 1 }} type="secondary">
                       {currentDirectory.split(/[\\/]/).pop()}
                     </Text>
                  )}
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Select size="small" placeholder={t('chat.select_tool')} value={activeToolId} onChange={setActiveToolId} options={activeTools.filter(id => toolStatuses[id]?.installed).map(id => ({ label: t(`tools.${id}`), value: id }))} suffixIcon={<CodeOutlined />} style={{ width: '100%' }} />
                  <Select size="small" placeholder={t('chat.select_config')} value={activeApiId} onChange={setActiveApiId} options={apiConfigs.map(api => ({ label: api.name, value: api.id }))} suffixIcon={<RobotOutlined />} style={{ width: '100%' }} />
                  {activeApiId && (
                      <div style={{ display: 'flex', gap: 4 }}>
                          <Select size="small" placeholder={t('chat.select_model')} value={apiConfigs.find(c => c.id === activeApiId)?.model} onChange={handleModelSelect} options={[...(apiConfigs.find(c => c.id === activeApiId)?.model ? [{ label: apiConfigs.find(c => c.id === activeApiId)?.model, value: apiConfigs.find(c => c.id === activeApiId)?.model! }] : []), ...(apiConfigs.find(c => c.id === activeApiId)?.models || []).filter(m => m !== apiConfigs.find(c => c.id === activeApiId)?.model).map(m => ({ label: m, value: m }))]} style={{ flex: 1 }} />
                          <Button size="small" icon={isFetchingModels ? <LoadingOutlined /> : <SendOutlined rotate={-45} />} onClick={handleFetchModels} disabled={isFetchingModels} />
                      </div>
                  )}
             </div>

             <div style={{ flex: 1, overflow: 'hidden' }}>
                <Collapse ghost defaultActiveKey={['project']} items={[{
                    key: 'project',
                    label: <Text strong style={{ fontSize: 12 }}><FolderOutlined /> {t('chat.project_files')}</Text>,
                    children: (
                        <div style={{ flex: 1, minHeight: 300, overflowY: 'auto', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, padding: 0, background: token.colorFillSecondary }}>
                            {currentDirectory ? (
                                loadingTree ? <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spin size="small" /></div> :
                                 <Tree 
                                    treeData={treeData} 
                                    loadData={onLoadData} 
                                    blockNode 
                                    height={400} 
                                    style={{ background: 'transparent', padding: '8px 12px' }} 
                                    titleRender={(node) => (
                                        <Dropdown
                                            menu={{
                                                items: [
                                                    { key: 'insert', label: t('chat.context_menu.insert'), icon: <SendOutlined /> },
                                                    { key: 'copy', label: t('chat.context_menu.copy_path'), icon: <CopyOutlined /> },
                                                    { type: 'divider' },
                                                    { key: 'rename', label: t('chat.context_menu.rename'), icon: <EditOutlined /> },
                                                    { key: 'delete', label: t('chat.context_menu.delete'), icon: <DeleteOutlined />, danger: true },
                                                ],
                                                onClick: ({ key, domEvent }) => {
                                                    domEvent.stopPropagation();
                                                    if (key === 'insert') handleInsertPath(node.key as string);
                                                    else if (key === 'copy') handleCopyPath(node.key as string);
                                                    else if (key === 'rename') {
                                                        setTargetNode({ key: node.key as string, title: node.title as string });
                                                        setNewName(node.title as string);
                                                        setRenameModalVisible(true);
                                                    }
                                                    else if (key === 'delete') handleDelete(node.key as string);
                                                }
                                            }}
                                            trigger={['contextMenu']}
                                        >
                                            <div 
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => { 
                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                    handleInsertPath(node.key as string); 
                                                }}
                                                style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    alignItems: 'center', 
                                                    width: '100%', 
                                                    cursor: 'pointer',
                                                    padding: '2px 4px',
                                                    borderRadius: 4,
                                                    transition: 'background 0.2s'
                                                }}
                                                className="file-tree-node-interactive"
                                            >
                                                <Text ellipsis style={{ fontSize: 12, flex: 1 }}>{node.title as string}</Text>
                                                <Tooltip title={t('chat.copy_path')}>
                                                    <Button 
                                                        size="small" 
                                                        type="text" 
                                                        icon={<CopyOutlined style={{ fontSize: 10 }} />} 
                                                        onClick={(e) => { e.stopPropagation(); handleCopyPath(node.key as string); }} 
                                                        style={{ padding: '0 4px', height: 20 }}
                                                    />
                                                </Tooltip>
                                            </div>
                                        </Dropdown>
                                    )} 
                                 />
                            ) : <div style={{ padding: 16, textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 12 }}>{t('chat.no_folder')}</Text></div>}
                        </div>
                    )
                }, {
                    key: 'sessions',
                    label: <Text strong style={{ fontSize: 12 }}><ClearOutlined /> {t('chat.sessions')}</Text>,
                    children: (
                        <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8, padding: '4px 0px', background: token.colorFillSecondary, marginTop: -8 }}>
                            <List size="small" dataSource={['Session 1', 'Session 2 (History)']} renderItem={(item) => <List.Item style={{ cursor: 'pointer', padding: '6px 8px' }}><Space><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a' }} /><Text ellipsis style={{ fontSize: 12 }}>{item}</Text></Space></List.Item>} />
                        </div>
                    )
                }]} />
             </div>
        </div>
      </Sider>
      
      <Layout style={{ background: 'transparent', display: 'flex', flexDirection: 'column' }}>
        <Content style={{ flex: 1, overflowY: 'auto', padding: '16px', background: token.colorBgContainer, borderRadius: token.borderRadiusLG, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 12, maxWidth: msg.role === 'user' ? '90%' : '100%', width: '100%' }}>
                  <Avatar icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} style={{ flexShrink: 0 }} />
                   <div style={{ background: msg.role === 'user' ? token.colorPrimary : token.colorFillSecondary, color: msg.role === 'user' ? '#fff' : token.colorText, padding: '8px 12px', borderRadius: 12, wordBreak: 'break-word', maxWidth: '100%', overflowX: 'auto' }}>
                     {msg.role === 'assistant' ? (
                        <div style={{ color: 'inherit', fontFamily: 'Consolas, monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                           {msg.blocks && msg.blocks.length > 0 && (
                               <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                   {msg.blocks.map((b, i) => b.type === 'tool_use' ? <Tooltip title={JSON.stringify(b.input)} key={i}><Button size="small" type="dashed" icon={<CodeOutlined />} style={{ fontSize: 10 }}>{b.name}</Button></Tooltip> : null)}
                               </div>
                           )}
                           <Ansi linkify={true}>{msg.content}</Ansi>
                           {msg.isStreaming && <LoadingOutlined style={{ marginLeft: 5 }} />}
                        </div>
                     ) : msg.content}
                   </div>
                </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </Content>

         <div style={{ background: token.colorBgContainer, padding: 16, borderRadius: token.borderRadiusLG, display: 'flex', gap: 10 }}>
          <TextArea 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder={t('chat.type_message')} 
            autoSize={{ minRows: 4, maxRows: 15 }} 
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }} 
            style={{ borderRadius: 8 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} style={{ height: 32 }} />
            <Tooltip title="Clear Chat">
              <Button icon={<ClearOutlined />} onClick={handleClear} size="small" />
            </Tooltip>
          </div>
        </div>
      </Layout>

      <Modal
        title={t('chat.rename_title')}
        open={renameModalVisible}
        onOk={handleRename}
        onCancel={() => setRenameModalVisible(false)}
        okText={t('chat.ok')}
        cancelText={t('chat.cancel')}
        destroyOnClose
      >
        <div style={{ padding: '10px 0' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('chat.new_name_label')}</Text>
            <Input 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                onPressEnter={handleRename}
                autoFocus
            />
        </div>
      </Modal>
    </Layout>
  );
};

export default Chat;
