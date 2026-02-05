/*
 * @Date: 2026-02-03 19:31:39
 * @Author: Anthony Rivera && opcnlin@gmail.com
 * @FilePath: \src\components\EnvironmentStatusInfo.tsx
 * Copyright (c) 2026 OpenVizUI Contributors
 * Licensed under the MIT License
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Tag, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const EnvironmentStatusInfo = () => {
  const { checkEnv, envStatus } = useAppStore();
  const { Text } = Typography;

  useEffect(() => {
    // Only check automatically if we don't have an environment status yet
    if (!envStatus) {
      checkEnv();
    }
  }, [checkEnv, envStatus]);

  if (!envStatus) {
    return <Space><LoadingOutlined /> <Text type="secondary">Checking environment...</Text></Space>;
  }

  const items = [
    { label: 'Node', version: envStatus.node_version },
    { label: 'npm', version: envStatus.npm_version },
    { label: 'Git', version: envStatus.git_version },
    { label: 'Python', version: envStatus.python_version },
    { label: 'Go', version: envStatus.go_version },
    { label: 'Java', version: envStatus.java_version },
  ];

  return (
    <Space size="large" style={{ width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
      {items.map((item) => (
        <Tag 
          key={item.label} 
          icon={item.version ? <CheckCircleOutlined /> : <CloseCircleOutlined />} 
          color={item.version ? 'success' : 'error'}
          style={{ margin: 0 }}
        >
          {item.label}: {item.version || 'Missing'}
        </Tag>
      ))}
    </Space>
  );
};

export default EnvironmentStatusInfo;
