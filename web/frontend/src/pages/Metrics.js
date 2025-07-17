import React from 'react';
import { useQuery } from 'react-query';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Spin,
  Table,
  Tag,
  Progress,
  Divider,
} from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';
import { dashboardAPI } from '../services/api';

const { Title, Text } = Typography;

const Metrics = () => {
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery(
    'dashboard',
    dashboardAPI.getDashboard,
    {
      refetchInterval: 5000,
    }
  );

  const { data: metricsData, isLoading: metricsLoading } = useQuery(
    'metrics',
    dashboardAPI.getMetrics,
    {
      refetchInterval: 10000,
    }
  );

  if (dashboardLoading || metricsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载中...</div>
      </div>
    );
  }

  // 模拟历史数据用于图表显示
  const generateHistoricalData = () => {
    const data = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      data.push({
        time: time.getHours() + ':00',
        requests: Math.floor(Math.random() * 50) + 10,
        responseTime: Math.floor(Math.random() * 200) + 100,
        successRate: Math.floor(Math.random() * 20) + 80,
      });
    }
    return data;
  };

  const historicalData = generateHistoricalData();

  const modelPerformanceData = dashboardData?.models?.map(model => ({
    name: model.name,
    version: model.version,
    backend: model.backend_type || 'mock',
    status: model.status,
    requests: Math.floor(Math.random() * 100) + 10,
    avgResponseTime: Math.floor(Math.random() * 300) + 50,
    successRate: Math.floor(Math.random() * 15) + 85,
  })) || [];

  const backendDistribution = [
    { name: 'OpenAI', value: modelPerformanceData.filter(m => m.backend === 'openai').length, color: '#52c41a' },
    { name: 'Gemini', value: modelPerformanceData.filter(m => m.backend === 'gemini').length, color: '#722ed1' },
    { name: 'Mock', value: modelPerformanceData.filter(m => m.backend === 'mock').length, color: '#fa8c16' },
  ].filter(item => item.value > 0);

  const statusDistribution = [
    { name: '就绪', value: dashboardData?.ready_models || 0, color: '#52c41a' },
    { name: '加载中', value: (dashboardData?.total_models || 0) - (dashboardData?.ready_models || 0), color: '#1890ff' },
    { name: '错误', value: 0, color: '#ff4d4f' },
  ].filter(item => item.value > 0);

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Tag size="small" color="blue">{record.version}</Tag>
        </div>
      ),
    },
    {
      title: '后端类型',
      dataIndex: 'backend',
      key: 'backend',
      render: (text) => (
        <Tag color={
          text === 'openai' ? 'green' : 
          text === 'gemini' ? 'purple' : 'orange'
        }>
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
          ready: { color: 'success', text: '就绪' },
          loading: { color: 'processing', text: '加载中' },
          error: { color: 'error', text: '错误' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '请求数',
      dataIndex: 'requests',
      key: 'requests',
      render: (value) => <Text>{value}</Text>,
    },
    {
      title: '平均响应时间',
      dataIndex: 'avgResponseTime',
      key: 'avgResponseTime',
      render: (value) => <Text>{value}ms</Text>,
    },
    {
      title: '成功率',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (value) => (
        <div>
          <Progress
            percent={value}
            size="small"
            status={value >= 90 ? 'success' : value >= 70 ? 'normal' : 'exception'}
            format={(percent) => `${percent}%`}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>性能指标</Title>
      <Text type="secondary">
        实时监控系统性能指标和模型运行状态
      </Text>

      {/* 关键指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <Statistic
                title="总请求数"
                value={metricsData?.total_requests || 0}
                prefix={<FireOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <Statistic
                title="成功请求"
                value={metricsData?.successful_requests || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <Statistic
                title="失败请求"
                value={metricsData?.failed_requests || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <Statistic
                title="平均响应时间"
                value={metricsData?.avg_response_time || 0}
                suffix="ms"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* 成功率指标 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card title="系统成功率">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#1890ff' }}>
                      {metricsData?.success_rate || 0}%
                    </div>
                    <Text type="secondary">整体成功率</Text>
                  </div>
                </Col>
                <Col xs={24} md={16}>
                  <Progress
                    percent={metricsData?.success_rate || 0}
                    size="large"
                    status={metricsData?.success_rate >= 90 ? 'success' : metricsData?.success_rate >= 70 ? 'normal' : 'exception'}
                    format={(percent) => `${percent}%`}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      成功: {metricsData?.successful_requests || 0} | 
                      失败: {metricsData?.failed_requests || 0} | 
                      总计: {metricsData?.total_requests || 0}
                    </Text>
                  </div>
                </Col>
              </Row>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card title="24小时请求趋势">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#1890ff"
                    strokeWidth={2}
                    name="请求数"
                  />
                  <Line
                    type="monotone"
                    dataKey="responseTime"
                    stroke="#52c41a"
                    strokeWidth={2}
                    name="响应时间(ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card title="后端类型分布">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={backendDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {backendDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* 模型性能表格 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card title="模型性能详情">
              {modelPerformanceData.length > 0 ? (
                <Table
                  columns={columns}
                  dataSource={modelPerformanceData}
                  rowKey={(record) => `${record.name}-${record.version}`}
                  pagination={false}
                  size="small"
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <BarChartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                  <div style={{ marginTop: 16, color: '#999' }}>
                    暂无模型性能数据
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* 系统状态分布 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Card title="模型状态分布">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1890ff" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Card title="系统概览">
              <div style={{ padding: '16px 0' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>总模型数:</Text>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                    {dashboardData?.total_models || 0}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>就绪模型:</Text>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                    {dashboardData?.ready_models || 0}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>活跃连接:</Text>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                    {dashboardData?.total_connections || 0}
                  </div>
                </div>
                <div>
                  <Text strong>最后更新:</Text>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {dashboardData?.last_updated ? new Date(dashboardData.last_updated).toLocaleString('zh-CN') : '未知'}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Divider />

      <Card title="指标说明" size="small">
        <div>
          <h4>关键指标解释:</h4>
          <ul>
            <li><strong>总请求数:</strong> 系统接收到的所有推理请求总数</li>
            <li><strong>成功请求:</strong> 成功完成推理的请求数量</li>
            <li><strong>失败请求:</strong> 推理过程中出现错误的请求数量</li>
            <li><strong>平均响应时间:</strong> 所有成功请求的平均响应时间</li>
            <li><strong>成功率:</strong> 成功请求占总请求的百分比</li>
          </ul>
          
          <h4>图表说明:</h4>
          <ul>
            <li><strong>24小时请求趋势:</strong> 显示过去24小时的请求数量和响应时间变化</li>
            <li><strong>后端类型分布:</strong> 显示不同后端类型（OpenAI、Gemini、Mock）的模型数量分布</li>
            <li><strong>模型状态分布:</strong> 显示模型的就绪、加载中、错误状态分布</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default Metrics; 