import React from 'react';
import { useQuery } from 'react-query';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Spin,
  Alert,
  Typography,
  Tooltip,
} from 'antd';
import {
  RobotOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { dashboardAPI, processAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading, error, refetch } = useQuery(
    'dashboard',
    dashboardAPI.getDashboard,
    {
      refetchInterval: 5000, // 每5秒刷新一次
    }
  );

  // 调试信息
  console.log('Dashboard Data:', dashboardData);
  console.log('Dashboard Data Type:', typeof dashboardData);
  console.log('Dashboard Data Keys:', dashboardData ? Object.keys(dashboardData) : 'null');
  console.log('Models Array:', dashboardData?.data?.models);
  console.log('Models Length:', dashboardData?.data?.models?.length);

  const { data: metricsData } = useQuery(
    'metrics',
    dashboardAPI.getMetrics,
    {
      refetchInterval: 10000, // 每10秒刷新一次
    }
  );

  const { data: processesData } = useQuery(
    'processes',
    processAPI.getAllProcesses,
    {
      refetchInterval: 3000, // 每3秒刷新一次
    }
  );

  // 调试信息
  console.log('Processes Data:', processesData);
  console.log('Processes Data Type:', typeof processesData);
  console.log('Processes Data Keys:', processesData ? Object.keys(processesData) : 'null');
  console.log('Running Processes:', processesData?.data?.running_processes);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="连接错误"
        description="无法连接到后端服务，请检查服务是否正常运行。"
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => refetch()}>
            重试
          </Button>
        }
      />
    );
  }

  const stats = [
    {
      title: '总模型数',
      value: dashboardData?.data?.total_models || 0,
      icon: <RobotOutlined />,
      color: '#1890ff',
    },
    {
      title: '就绪模型',
      value: dashboardData?.data?.ready_models || 0,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
    },
    {
      title: '活跃连接',
      value: dashboardData?.data?.total_connections || 0,
      icon: <MessageOutlined />,
      color: '#722ed1',
    },
    {
      title: '运行进程',
      value: processesData?.data?.running_processes || 0,
      icon: <PlayCircleOutlined />,
      color: '#13c2c2',
    },
  ];

  const modelColumns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '后端类型',
      dataIndex: 'backend_type',
      key: 'backend_type',
      render: (text) => (
        <Tag color={text === 'openai' ? 'green' : text === 'gemini' ? 'purple' : 'orange'}>
          {text?.toUpperCase() || 'MOCK'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          ready: { color: 'success', text: '就绪', icon: <CheckCircleOutlined /> },
          loading: { color: 'processing', text: '加载中', icon: <SyncOutlined spin /> },
          error: { color: 'error', text: '错误', icon: <ExclamationCircleOutlined /> },
          stopped: { color: 'default', text: '已停止', icon: <StopOutlined /> },
        };
        const config = statusConfig[status] || { color: 'default', text: status, icon: null };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '进程端口',
      dataIndex: 'port',
      key: 'port',
      render: (port) => port ? <Tag color="cyan">{port}</Tag> : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/inference', { state: { model: record } })}
          >
            测试推理
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/models')}
          >
            管理
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>系统仪表盘</Title>
      <Text type="secondary">
        最后更新: {dashboardData?.data?.last_updated ? new Date(dashboardData.data.last_updated).toLocaleString('zh-CN') : '未知'}
      </Text>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={React.cloneElement(stat.icon, { style: { color: stat.color } })}
                  valueStyle={{ color: stat.color }}
                />
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card
            title="模型列表"
            extra={
              <Space>
                <Button onClick={() => refetch()}>刷新</Button>
                <Button type="primary" onClick={() => navigate('/models')}>
                  管理模型
                </Button>
              </Space>
            }
          >
            {dashboardData?.data?.models && dashboardData.data.models.length > 0 ? (
              <Table
                columns={modelColumns}
                dataSource={dashboardData.data.models}
                rowKey={(record) => `${record.name}-${record.version}`}
                pagination={false}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <RobotOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <div style={{ marginTop: 16, color: '#999' }}>
                  暂无模型，请先注册模型
                </div>
                <Button
                  type="primary"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate('/models')}
                >
                  注册模型
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {processesData?.data?.processes && processesData.data.processes.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title="进程状态">
              <Table
                columns={[
                  {
                    title: '模型',
                    dataIndex: 'model_name',
                    key: 'model_name',
                    render: (text, record) => (
                      <Space>
                        <Text strong>{text}</Text>
                        <Tag color="blue">{record.version}</Tag>
                      </Space>
                    ),
                  },
                  {
                    title: '进程ID',
                    dataIndex: 'pid',
                    key: 'pid',
                    render: (pid) => <Tag color="orange">{pid}</Tag>,
                  },
                  {
                    title: '端口',
                    dataIndex: 'port',
                    key: 'port',
                    render: (port) => <Tag color="cyan">{port}</Tag>,
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => {
                      const statusConfig = {
                        running: { color: 'success', text: '运行中' },
                        stopped: { color: 'default', text: '已停止' },
                        error: { color: 'error', text: '错误' },
                      };
                      const config = statusConfig[status] || { color: 'default', text: status };
                      return <Tag color={config.color}>{config.text}</Tag>;
                    },
                  },
                  {
                    title: '启动时间',
                    dataIndex: 'start_time',
                    key: 'start_time',
                    render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Space>
                        <Tooltip title="重启进程">
                          <Button
                            type="link"
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => {
                              // 这里可以添加重启进程的逻辑
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="查看日志">
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              // 这里可以添加查看日志的逻辑
                            }}
                          >
                            日志
                          </Button>
                        </Tooltip>
                      </Space>
                    ),
                  },
                ]}
                dataSource={processesData.data.processes}
                rowKey={(record) => `${record.model_name}-${record.version}-${record.pid}`}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}

      {metricsData && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title="性能指标">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="总请求数"
                    value={metricsData.total_requests || 0}
                    prefix={<MessageOutlined />}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="成功请求"
                    value={metricsData.successful_requests || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="平均响应时间"
                    value={metricsData.avg_response_time || 0}
                    suffix="ms"
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title="活跃连接"
                    value={metricsData.active_connections || 0}
                    prefix={<MessageOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Dashboard; 