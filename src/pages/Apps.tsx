import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { 
  Tabs, 
  Card, 
  List, 
  Button, 
  Tag, 
  Typography, 
  Input, 
  theme,
  Progress,
  Modal,
  message
} from 'antd';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  DownloadOutlined, 
  CheckCircleOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  CodeOutlined // Added this
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;

interface AppItem {
  name: string;
  description: string;
  category: string;
  installed?: boolean;
  version?: string;
  downloadUrl?: string;
  filename?: string;
  checkCmd?: string;
  checkArgs?: string[];
  icon?: string;
}

const Apps = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Download State
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [currentDownload, setCurrentDownload] = useState<string>('');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [installedApps, setInstalledApps] = useState<string[]>([]);

  const defaultTab = location.state?.activeTab || 'languages';

  // Define categories and their apps
  // 编程语言：Python,Go,Java,Bun,Rust,PHP,Erlang,Perl,Ruby
  // WEB服务：Apache,Caddy,Tomcat,Nginx,Consul
  // 数据库：MariaDB,MongoDB,MySQL,PostgreSQL
  // 缓存&队列：Redis,Memcached,Etcd,RabbitMQ
  // 工具&容器：NodeJS,Git,Podman,docker,Minio
  
  const allApps: AppItem[] = [
    // Languages
    { 
        name: t('apps.items.python.name'), 
        category: 'languages', 
        description: t('apps.items.python.desc'),
        downloadUrl: 'https://www.python.org/ftp/python/3.12.2/python-3.12.2-amd64.exe',
        filename: 'python-installer.exe',
        checkCmd: 'python',
        checkArgs: ['--version'],
        icon: '/icons/python-original.svg'
    },
    { 
        name: t('apps.items.go.name'), 
        category: 'languages', 
        description: t('apps.items.go.desc'),
        downloadUrl: 'https://go.dev/dl/go1.22.1.windows-amd64.msi',
        filename: 'go-installer.msi',
        checkCmd: 'go',
        checkArgs: ['version'],
        icon: '/icons/go-original-wordmark.svg'
    },
    { 
        name: t('apps.items.java.name'), 
        category: 'languages', 
        description: t('apps.items.java.desc'),
        downloadUrl: 'https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.exe', 
        filename: 'jdk-installer.exe',
        checkCmd: 'java',
        checkArgs: ['-version'],
        icon: '/icons/java-original.svg'
    },
    { 
        name: t('apps.items.bun.name'), 
        category: 'languages', 
        description: t('apps.items.bun.desc'),
        downloadUrl: 'https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip',
        filename: 'bun-windows-x64.zip',
        checkCmd: 'bun',
        checkArgs: ['--version'],
        icon: '/icons/bun-original.svg'
    },
    { 
        name: t('apps.items.rust.name'), 
        category: 'languages', 
        description: t('apps.items.rust.desc'),
        downloadUrl: 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe',
        filename: 'rustup-init.exe',
        checkCmd: 'rustc',
        checkArgs: ['--version'],
        icon: '/icons/rust-original.svg'
    },
    { 
        name: t('apps.items.php.name'), 
        category: 'languages', 
        description: t('apps.items.php.desc'),
        downloadUrl: 'https://windows.php.net/downloads/releases/php-8.3.4-Win32-vs16-x64.zip',
        filename: 'php-8.3.4-windows.zip',
        checkCmd: 'php',
        checkArgs: ['-v'],
        icon: '/icons/php-original.svg'
    },
    { 
        name: t('apps.items.erlang.name'), 
        category: 'languages', 
        description: t('apps.items.erlang.desc'),
        downloadUrl: 'https://github.com/erlang/otp/releases/download/OTP-26.2.3/otp_win64_26.2.3.exe',
        filename: 'otp-installer.exe',
        checkCmd: 'erl',
        checkArgs: ['-version'],
        icon: '/icons/erlang-original.svg'
    },
    { 
        name: t('apps.items.perl.name'), 
        category: 'languages', 
        description: t('apps.items.perl.desc'),
        downloadUrl: 'https://github.com/StrawberryPerl/Perl-Dist-Strawberry/releases/download/SP_53822_64bit_UCRT/strawberry-perl-5.38.2.2-64bit-portable.zip',
        filename: 'strawberry-perl.zip',
        checkCmd: 'perl',
        checkArgs: ['-v'],
        icon: '/icons/perl-original.svg'
    },
    { 
        name: t('apps.items.ruby.name'), 
        category: 'languages', 
        description: t('apps.items.ruby.desc'),
        downloadUrl: 'https://github.com/oneclick/rubyinstaller2/releases/download/RubyInstaller-3.3.0-1/rubyinstaller-3.3.0-1-x64.exe',
        filename: 'ruby-installer.exe',
        checkCmd: 'ruby',
        checkArgs: ['-v'],
        icon: '/icons/ruby-original.svg'
    },
    
    // Web Services
    { 
        name: t('apps.items.apache.name'), 
        category: 'web', 
        description: t('apps.items.apache.desc'), 
        downloadUrl: 'https://www.apachelounge.com/download/VS17/binaries/httpd-2.4.58-win64-VS17.zip',
        filename: 'apache-httpd.zip',
        checkCmd: 'httpd',
        checkArgs: ['-v'],
        icon: '/icons/apache-original.svg' 
    },
    { 
        name: t('apps.items.caddy.name'), 
        category: 'web', 
        description: t('apps.items.caddy.desc'), 
        downloadUrl: 'https://caddyserver.com/api/download?os=windows&arch=amd64',
        filename: 'caddy.exe',
        checkCmd: 'caddy',
        checkArgs: ['version'],
        icon: '/icons/caddy.svg' 
    },
    { 
        name: t('apps.items.tomcat.name'), 
        category: 'web', 
        description: t('apps.items.tomcat.desc'), 
        downloadUrl: 'https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.20/bin/apache-tomcat-10.1.20-windows-x64.zip',
        filename: 'apache-tomcat.zip',
        checkCmd: 'catalina.bat',
        checkArgs: ['version'],
        icon: '/icons/tomcat-original.svg' 
    },
    { 
        name: t('apps.items.nginx.name'), 
        category: 'web', 
        description: t('apps.items.nginx.desc'), 
        downloadUrl: 'http://nginx.org/download/nginx-1.24.0.zip',
        filename: 'nginx-1.24.0.zip',
        checkCmd: 'nginx',
        checkArgs: ['-v'],
        icon: '/icons/nginx-original.svg' 
    },
    { 
        name: t('apps.items.consul.name'), 
        category: 'web', 
        description: t('apps.items.consul.desc'), 
        downloadUrl: 'https://releases.hashicorp.com/consul/1.18.1/consul_1.18.1_windows_amd64.zip',
        filename: 'consul.zip',
        checkCmd: 'consul',
        checkArgs: ['--version'],
        icon: '/icons/consul-original.svg' 
    },
    
    // Databases
    { 
        name: t('apps.items.mariadb.name'), 
        category: 'database', 
        description: t('apps.items.mariadb.desc'), 
        downloadUrl: 'https://archive.mariadb.org/mariadb-11.3.2/winx64-packages/mariadb-11.3.2-winx64.msi',
        filename: 'mariadb-installer.msi',
        checkCmd: 'mariadb',
        checkArgs: ['--version'],
        icon: '/icons/mariadb-original.svg' 
    },
    { 
        name: t('apps.items.mongodb.name'), 
        category: 'database', 
        description: t('apps.items.mongodb.desc'), 
        downloadUrl: 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.6-signed.msi',
        filename: 'mongodb-installer.msi',
        checkCmd: 'mongod',
        checkArgs: ['--version'],
        icon: '/icons/mongodb-original.svg' 
    },
    { 
        name: t('apps.items.mysql.name'), 
        category: 'database', 
        description: t('apps.items.mysql.desc'), 
        downloadUrl: 'https://dev.mysql.com/get/Downloads/MySQL-8.3/mysql-8.3.0-winx64.msi',
        filename: 'mysql-installer.msi',
        checkCmd: 'mysql',
        checkArgs: ['--version'],
        icon: '/icons/mysql-original.svg' 
    },
    { 
        name: t('apps.items.postgresql.name'), 
        category: 'database', 
        description: t('apps.items.postgresql.desc'), 
        downloadUrl: 'https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64.exe',
        filename: 'postgresql-installer.exe',
        checkCmd: 'psql',
        checkArgs: ['--version'],
        icon: '/icons/postgresql-original.svg' 
    },
    
    // Cache & Queue
    { 
        name: t('apps.items.redis.name'), 
        category: 'cache_queue', 
        description: t('apps.items.redis.desc'), 
        downloadUrl: 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip',
        filename: 'redis-windows.zip',
        checkCmd: 'redis-server',
        checkArgs: ['--version'],
        icon: '/icons/redis-original.svg' 
    },
    { 
        name: t('apps.items.memcached.name'), 
        category: 'cache_queue', 
        description: t('apps.items.memcached.desc'), 
        downloadUrl: 'https://github.com/memcached/memcached/releases/download/1.6.24/memcached-1.6.24.tar.gz',
        filename: 'memcached.tar.gz',
        icon: '/icons/memcached.svg' 
    }, 
    { 
        name: t('apps.items.rabbitmq.name'), 
        category: 'cache_queue', 
        description: t('apps.items.rabbitmq.desc'), 
        downloadUrl: 'https://github.com/rabbitmq/rabbitmq-server/releases/download/v3.13.0/rabbitmq-server-3.13.0.exe',
        filename: 'rabbitmq-installer.exe',
        checkCmd: 'rabbitmqctl',
        checkArgs: ['version'],
        icon: '/icons/rabbitmq-original.svg' 
    },
    { 
        name: t('apps.items.etcd.name'), 
        category: 'cache_queue', 
        description: t('apps.items.etcd.desc'), 
        downloadUrl: 'https://github.com/etcd-io/etcd/releases/download/v3.5.12/etcd-v3.5.12-windows-amd64.zip',
        filename: 'etcd.zip',
        checkCmd: 'etcd',
        checkArgs: ['--version'],
        icon: '/icons/etcd-icon-color.svg' 
    },

    // Tools
    { 
        name: t('apps.items.nodejs.name'), 
        category: 'tools', 
        description: t('apps.items.nodejs.desc'),
        downloadUrl: 'https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi',
        filename: 'node-installer.msi',
        checkCmd: 'node',
        checkArgs: ['-v'],
        icon: '/icons/nodejs-original.svg'
    },
    { 
        name: t('apps.items.git.name'), 
        category: 'tools', 
        description: t('apps.items.git.desc'), 
        downloadUrl: 'https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe',
        filename: 'git-installer.exe',
        checkCmd: 'git',
        checkArgs: ['--version'],
        icon: '/icons/git-original.svg'
    },
    { 
        name: t('apps.items.podman.name'), 
        category: 'tools', 
        description: t('apps.items.podman.desc'), 
        downloadUrl: 'https://github.com/containers/podman/releases/download/v4.9.4/podman-v4.9.4.msi',
        filename: 'podman-installer.msi',
        checkCmd: 'podman',
        checkArgs: ['--version'],
        icon: '/icons/podman-original.svg' 
    },
    { 
        name: t('apps.items.docker.name'), 
        category: 'tools', 
        description: t('apps.items.docker.desc'), 
        downloadUrl: 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe',
        filename: 'docker-desktop-installer.exe',
        checkCmd: 'docker',
        checkArgs: ['--version'],
        icon: '/icons/docker-original.svg' 
    },
    { 
        name: t('apps.items.minio.name'), 
        category: 'tools', 
        description: t('apps.items.minio.desc'), 
        downloadUrl: 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe',
        filename: 'minio.exe',
        checkCmd: 'minio',
        checkArgs: ['--version'],
        icon: '/icons/minio.svg' 
    },
  ];

  const categories = [
    { key: 'languages', label: t('apps.categories.languages'), icon: <CodeOutlined /> },
    { key: 'web', label: t('apps.categories.web'), icon: <CloudServerOutlined /> },
    { key: 'database', label: t('apps.categories.database'), icon: <DatabaseOutlined /> },
    { key: 'cache_queue', label: t('apps.categories.cache_queue'), icon: <ThunderboltOutlined /> },
    { key: 'tools', label: t('apps.categories.tools'), icon: <ToolOutlined /> },
  ];
  
  // Check statuses on mount
  useEffect(() => {
      const checkStatuses = async () => {
          const installed = [];
          for (const app of allApps) {
              if (app.checkCmd && app.checkArgs) {
                  try {
                       const version = await invoke('check_executable', { 
                           program: app.checkCmd, 
                           args: app.checkArgs 
                       });
                       if (version) {
                           installed.push(app.name);
                       }
                  } catch (e) {
                      // ignore
                  }
              }
          }
          setInstalledApps(installed);
      };
      checkStatuses();
  }, []);

  // Logic to filter apps using useMemo to avoid re-calc on every render
  const filteredApps = (category: string) => {
    return allApps.filter(app => {
      const matchesCategory = app.category === category;
      const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            app.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  };

  // Mock install handler
  const handleInstall = async (app: AppItem) => {
    if (installedApps.includes(app.name)) {
        message.info(t('apps.messages.alreadyInstalled', { name: app.name }));
        return;
    }
    
    // Double check real quick? Optional based on latency.
    if (app.checkCmd && app.checkArgs) {
        try {
            const version = await invoke('check_executable', { 
                 program: app.checkCmd, 
                 args: app.checkArgs 
            });
            if (version) {
                 setInstalledApps(prev => [...prev, app.name]);
                 message.info(t('apps.messages.actuallyAlreadyInstalled', { name: app.name, version }));
                 return;
            }
        } catch (e) { }
    }

    if (!app.downloadUrl || !app.filename) {
        message.warning(t('apps.messages.notConfigured', { name: app.name }));
        return;
    }

    console.log(`Starting download for ${app.name}...`);
    setCurrentDownload(app.name);
    setDownloadPercent(0);
    setDownloadModalVisible(true);

    try {
        // Listen for progress
        const unlisten = await listen('download-progress', (event: any) => {
            const payload = event.payload;
            // Check if it matches our file? payload.filename
            if (payload.filename === app.filename) {
                setDownloadPercent(Math.round(payload.percent * 10) / 10);
            }
        });

        // Trigger download
        const savedPath = await invoke('download_file', { 
            url: app.downloadUrl, 
            filename: app.filename 
        });
        
        console.log('Download saved to:', savedPath);
        
        // Check if we need to extract
        if (app.filename.endsWith('.zip') || app.filename.endsWith('.tar.gz') || app.filename.endsWith('.tgz')) {
            console.log('Extracting archive...');
            setIsExtracting(true);
            try {
                const extractDir = await invoke('extract_file', { path: savedPath });
                console.log('Extraction complete:', extractDir);
            } catch (e) {
                console.error('Extraction failed:', e);
                message.warning(`Download succeeded but extraction failed: ${e}`);
            }
            setIsExtracting(false);
        }

        // Success
        setDownloadModalVisible(false);
        setInstalledApps(prev => [...prev, app.name]);
        message.success(t('apps.downloadModal.success', { name: app.name }));
        
        // Clean up listener
        unlisten();

    } catch (error) {
        console.error('Download failed:', error);
        setDownloadModalVisible(false);
        setIsExtracting(false);
        message.error(t('apps.downloadModal.failed', { error }));
    }
  };
  
  const isInstalled = (appName: string) => installedApps.includes(appName);
  
  // Icon helper import fix
  // We need CodeOutlined for languages which is not imported above, let's add it roughly or reuse
  // Actually I imported specific icons above. Let's use what I have.
  // I used CodeOutlined for languages in the categories array but forgot to import it.
  // Adding CodeOutlined to imports.
  
  return (
      <div style={{ padding: '0px 24px 24px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
                <div>
                     <Title level={2} style={{ margin: 0 }}>{t('apps.title')}</Title>
                     <Text type="secondary">{t('apps.subtitle')}</Text>
                </div>
                <Search 
                    placeholder={t('apps.searchPlaceholder')} 
                    allowClear 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: 300 }} 
                />
            </div>

            <Card styles={{ body: { padding: 0 } }} bordered={false}>
                <Tabs 
                    tabPosition="left" 
                    defaultActiveKey={defaultTab}
                    items={categories.map(cat => ({
                        key: cat.key,
                        label: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {cat.icon}
                                {cat.label}
                            </span>
                        ),
                        children: (
                            <div style={{ padding: '0 24px 24px 24px' }}>
                                <Title level={4} style={{ marginTop: 16, marginBottom: 24 }}>{cat.label}</Title>
                                <List
                                    grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                                    dataSource={filteredApps(cat.key)}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <Card 
                                                hoverable 
                                                style={{ height: '100%' }}
                                                actions={[
                                                    <Button 
                                                        type={isInstalled(item.name) ? 'default' : 'primary'} 
                                                        icon={isInstalled(item.name) ? <CheckCircleOutlined /> : <DownloadOutlined />} 
                                                        onClick={() => handleInstall(item)}
                                                        disabled={isInstalled(item.name)}
                                                    >
                                                        {isInstalled(item.name) ? t('app.installed') : t('app.install')}
                                                    </Button>
                                                ]}
                                            >
                                                <Card.Meta
                                                    avatar={
                                                        <div style={{ 
                                                            width: 48, 
                                                            height: 48, 
                                                            background: token.colorFillSecondary, 
                                                            borderRadius: 8,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: 24,
                                                            fontWeight: 'bold',
                                                            color: token.colorPrimary,
                                                            overflow: 'hidden'
                                                        }}>
                                                            {item.icon ? (
                                                                <img src={item.icon} alt={item.name} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                                                            ) : (
                                                                item.name.charAt(0)
                                                            )}
                                                        </div>
                                                    }
                                                    title={
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span>{item.name}</span>
                                                            {item.installed && <Tag color="success"><CheckCircleOutlined /> {t('app.installed')}</Tag>}
                                                        </div>
                                                    }
                                                    description={<div style={{ height: 44, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={item.description}>{item.description}</div>}
                                                />
                                            </Card>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        )
                    }))}
                />
            </Card>

            <Modal
                title={t('apps.downloadModal.title', { name: currentDownload })}
                open={downloadModalVisible}
                footer={null}
                closable={false}
                centered
            >
                <div style={{ textAlign: 'center', padding: 20 }}>
                    <Progress 
                        type="circle" 
                        percent={downloadPercent} 
                        status={isExtracting ? 'active' : 'normal'}
                    />
                    <div style={{ marginTop: 16 }}>
                        <Text>{isExtracting ? t('apps.downloadModal.extracting') : t('apps.downloadModal.waiting')}</Text>
                    </div>
                    <div style={{ marginTop: 8 }}>
                         <Text type="secondary" style={{ fontSize: 12 }}>{t('apps.downloadModal.savePath')}</Text>
                    </div>
                </div>
            </Modal>
      </div>
  );
};

export default Apps;
