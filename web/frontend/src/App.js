import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  MessageOutlined,
  ExperimentOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Dashboard from './pages/Dashboard';
import ModelManagement from './pages/ModelManagement';
import Inference from './pages/Inference';
import ConcurrencyTest from './pages/ConcurrencyTest';
import Settings from './pages/Settings';

const { Header, Sider, Content } = Layout;

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/models',
      icon: <RobotOutlined />,
      label: '模型管理',
    },
    {
      key: '/inference',
      icon: <MessageOutlined />,
      label: '推理测试',
    },
    {
      key: '/concurrency',
      icon: <ExperimentOutlined />,
      label: '并发测试',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div className="logo">PineAI</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, paddingLeft: 16 }}>
          <h2 style={{ margin: 0, color: '#1890ff' }}>
            多模型托管与推理服务平台
          </h2>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/models" element={<ModelManagement />} />
            <Route path="/inference" element={<Inference />} />
            <Route path="/concurrency" element={<ConcurrencyTest />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Content>
      </Layout>
      <Toaster position="top-right" />
    </Layout>
  );
}

export default App; 