import { useState, useRef, useEffect, useCallback } from 'react';
import { Layout, Input, Button, List, Avatar, Typography, Space, theme, Tooltip, Tree, Select, Spin } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, LoadingOutlined, ClearOutlined, FolderOutlined, FileOutlined, CodeOutlined } from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import { useTranslation } from 'react-i18next';
import { ptyOpen, ptyWrite, ptyClose } from '../lib/tauri';
import { listen } from '@tauri-apps/api/event';
import ReactMarkdown from 'react-markdown';
import { readDir } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { DataNode } from 'antd/es/tree';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

const Chat = () => {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const { 
    apiConfigs, 
    activeApiId, 
    setActiveApiId,
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
  // Ref to track current accumulator for response parsing
  const outputBufferRef = useRef('');
  const responseIdRef = useRef<string | null>(null);

  // File Tree State
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  // Helper to load directory
  const loadDirectory = useCallback(async (path: string): Promise<DataNode[]> => {
      try {
          const entries = await readDir(path);
          // Sort: Folders first, then files
          entries.sort((a, b) => {
              if (a.isDirectory && !b.isDirectory) return -1;
              if (!a.isDirectory && b.isDirectory) return 1;
              return a.name.localeCompare(b.name);
          });

          return entries.map(entry => ({
              title: entry.name,
              key: `${path}/${entry.name}`.replace(/\/\//g, '/'), // Simple path join
              isLeaf: !entry.isDirectory,
              icon: entry.isDirectory ? <FolderOutlined /> : <FileOutlined />
          }));
      } catch (e) {
          console.error("Failed to read dir", path, e);
          return [];
      }
  }, []);

  // Update Tree when currentDirectory changes
  useEffect(() => {
      if (currentDirectory) {
          setLoadingTree(true);
          loadDirectory(currentDirectory).then(data => {
              setTreeData(data);
              setLoadingTree(false);
          });
      }
  }, [currentDirectory, loadDirectory]);

  const onLoadData = async ({ key, children }: any) => {
    if (children) return;
    const path = key as string;
    const newChildren = await loadDirectory(path);
    setTreeData((origin) =>
      updateTreeData(origin, key, newChildren)
    );
  };

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

  const handleSelectDirectory = async () => {
        try {
            const selected = await openDialog({
                directory: true,
                multiple: false,
                defaultPath: currentDirectory || undefined,
            });
            if (selected && typeof selected === 'string') {
                setCurrentDirectory(selected);
            }
        } catch (e) {
            console.error("Failed to select dir", e);
        }
  };

  const installedTools = activeTools.filter(id => toolStatuses[id]?.installed);
  
  // Helper to strip ANSI codes
  const stripAnsi = (str: string) => {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  };

  const initChatPty = useCallback(async () => {
    try {
        await ptyClose();
        // Standard wide column width for better markdown rendering
        await ptyOpen(120, 40); 

        // Auto-start active tool
        if (activeToolId) {
             const commandMap: Record<string, string> = {
               'google': 'gemini',
               'claude': 'claude',
             };
             const cmd = commandMap[activeToolId] || activeToolId;
             
             // Wait briefly then start
             setTimeout(() => {
                 ptyWrite(`${cmd}\r`);
             }, 500);
        }
    } catch (e) {
        console.error('Failed to init chat PTY', e);
    }
  }, [activeToolId]);

  useEffect(() => {
    let unlisten: () => void;

    const setupListener = async () => {
        unlisten = await listen<string>('pty-data', (event) => {
            const raw = event.payload;
            const text = stripAnsi(raw);
            
            // Ignore empty or structural updates
            if (!text.trim() && raw.length < 10) return;

            outputBufferRef.current += text;
            
            // Very basic heuristic: update the last assistant message
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.isStreaming) {
                    // Update existing streaming message
                    // Filter out the user's echoed input if we can detect it (naive)
                    let cleanContent = outputBufferRef.current;
                    
                    // Simple cleaning of prompts (adjust per tool behavior)
                    cleanContent = cleanContent.replace(/^> /, '').trimStart();
                    
                    return [
                        ...prev.slice(0, -1),
                        { ...last, content: cleanContent }
                    ];
                } else if (responseIdRef.current) {
                   // We have started a response ID but no message for it yet? (Shouldn't happen with current logic)
                   return prev;
                } else {
                   // Start new assistant message if we receive data and don't have one pending
                   // (Handling unsolicited output or initial startup messages)
                   if (!last || last.role === 'user') {
                       const newMsg: Message = {
                           id: Date.now().toString(),
                           role: 'assistant',
                           content: text,
                           timestamp: Date.now(),
                           isStreaming: true
                       };
                       outputBufferRef.current = text; // Reset buffer as new start
                       return [...prev, newMsg];
                   }
                   return prev;
                }
            });
        });
    };

    setupListener();
    initChatPty();

    return () => {
        if (unlisten) unlisten();
        ptyClose();
    };
  }, [initChatPty]);

  const sendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    };

    // Commit previous assistant message as done
    setMessages(prev => {
        return prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m).concat(newMessage);
    });
    
    // Clear buffer for new response
    outputBufferRef.current = '';
    responseIdRef.current = (Date.now() + 1).toString();
    
    // Prepare next assistant slot
    setMessages(prev => [
        ...prev,
        {
            id: responseIdRef.current!,
            role: 'assistant',
            content: '...', // Placeholder
            timestamp: Date.now(),
            isStreaming: true
        }
    ]);

    setInputValue('');
    
    // Send to PTY
    ptyWrite(`${inputValue}\r`);
  };

  const handleClear = () => {
      setMessages([]);
      outputBufferRef.current = '';
      ptyWrite('clear\r'); // Try to clear backend state too
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <Layout style={{ height: '100%', background: 'transparent' }}>
      <Sider width={250} style={{ background: token.colorBgContainer, marginRight: 16, borderRadius: token.borderRadiusLG, padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
             
             {/* Section 1: Project */}
             <div style={{ display: 'flex', flexDirection: 'column', minHeight: '30%', maxHeight: '40%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Title level={5} style={{ margin: 0, fontSize: 13, color: token.colorTextSecondary }}>
                        Project
                    </Title>
                    <Tooltip title="Change Directory">
                        <Button type="text" size="small" icon={<FolderOutlined />} onClick={handleSelectDirectory} />
                    </Tooltip>
                </div>
                <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    border: `1px solid ${token.colorBorderSecondary}`, 
                    borderRadius: 8, 
                    padding: 4,
                    background: token.colorFillTertiary
                }}>
                    {currentDirectory ? (
                        loadingTree ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                                <Spin size="small" />
                            </div>
                        ) : (
                        <Tree
                            treeData={treeData}
                            loadData={onLoadData}
                            height={200} // Virtual scroll if huge
                            blockNode
                            style={{ background: 'transparent' }}
                            titleRender={(node) => (
                                <Text ellipsis style={{ fontSize: 13 }}>{node.title as string}</Text>
                            )}
                        />
                       )
                    ) : (
                        <div style={{ padding: 16, textAlign: 'center' }}>
                             <Text type="secondary" style={{ fontSize: 12 }}>No Folder Open</Text>
                             <Button size="small" type="primary" style={{ marginTop: 8 }} onClick={handleSelectDirectory}>Open</Button>
                        </div>
                    )}
                </div>
                {currentDirectory && <Text type="secondary" ellipsis style={{ fontSize: 10, marginTop: 4 }}>{currentDirectory}</Text>}
             </div>

             {/* Section 2: Config */}
             <div>
                <Title level={5} style={{ margin: '0 0 8px 0', fontSize: 13, color: token.colorTextSecondary }}>
                    Configuration
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Select
                        size="small"
                        placeholder="Select Tool"
                        value={activeToolId}
                        onChange={setActiveToolId}
                        options={installedTools.map(id => ({ label: t(`tools.${id}`), value: id }))}
                        suffixIcon={<CodeOutlined />}
                        style={{ width: '100%' }}
                    />
                     <Select
                        size="small"
                        placeholder="Select Model"
                        value={activeApiId}
                        onChange={setActiveApiId}
                        options={apiConfigs.map(api => ({ label: api.name, value: api.id }))}
                        suffixIcon={<RobotOutlined />}
                        style={{ width: '100%' }}
                    />
                </div>
             </div>

             {/* Section 3: Sessions */}
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Title level={5} style={{ margin: 0, fontSize: 13, color: token.colorTextSecondary }}>Sessions</Title>
                    <Tooltip title="Clear Chat">
                        <Button size="small" type="text" icon={<ClearOutlined />} onClick={handleClear} />
                    </Tooltip>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <List
                    size="small"
                    dataSource={['Session 1', 'Session 2 (History)']}
                    renderItem={(item) => (
                        <List.Item style={{ cursor: 'pointer', padding: '8px 4px', borderRadius: 4, transition: 'background 0.2s' }} className="hover:bg-gray-100">
                        <Space>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a' }} />
                            <Text ellipsis style={{ fontSize: 13 }}>{item}</Text>
                        </Space>
                        </List.Item>
                    )}
                    />
                </div>
             </div>

        </div>
      </Sider>
      
      <Layout style={{ background: 'transparent', display: 'flex', flexDirection: 'column' }}>
        <Content 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px', 
            background: token.colorBgContainer, 
            borderRadius: token.borderRadiusLG,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              style={{ 
                display: 'flex', 
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
               <div style={{ 
                 display: 'flex', 
                 flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', 
                 gap: 12,
                 maxWidth: '70%'
               }}>
                  <Avatar icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />} style={{ flexShrink: 0 }} />
                   <div style={{
                     background: msg.role === 'user' ? token.colorPrimary : token.colorFillSecondary,
                     color: msg.role === 'user' ? '#fff' : token.colorText,
                     padding: '8px 12px',
                     borderRadius: 12,
                     wordBreak: 'break-word',
                     maxWidth: '100%',
                     overflowX: 'auto'
                   }}>
                     {msg.role === 'assistant' ? (
                        <div className="markdown-body" style={{ color: 'inherit' }}>
                           <ReactMarkdown>{msg.content}</ReactMarkdown>
                           {msg.isStreaming && <LoadingOutlined style={{ marginLeft: 5 }} />}
                        </div>
                     ) : (
                       msg.content
                     )}
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
            placeholder="Type a message..." 
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={sendMessage} style={{ height: 'auto' }} />
        </div>
      </Layout>
    </Layout>
  );
};

export default Chat;
