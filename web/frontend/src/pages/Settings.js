import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  Collapse,
  List,
  Tag,
  Row,
  Col,
  Switch,
  Select,
  message,
} from 'antd';
import {
  SettingOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  BookOutlined,
  BugOutlined,
  GithubOutlined,
  ApiOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { TextArea } = Input;

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSaveSettings = async (values) => {
    setLoading(true);
    try {
      // 这里可以添加保存设置的逻辑
      console.log('保存设置:', values);
      message.success('设置保存成功！');
    } catch (error) {
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const systemInfo = {
    version: '1.0.0',
    buildTime: '2024-01-17',
    goVersion: '1.21.0',
    platform: 'darwin/amd64',
    uptime: '2小时30分钟',
    memoryUsage: '128MB',
    cpuUsage: '5%',
  };

  const apiEndpoints = [
    {
      method: 'GET',
      path: '/api/v1/models',
      description: '获取模型列表',
    },
    {
      method: 'POST',
      path: '/api/v1/models',
      description: '注册新模型',
    },
    {
      method: 'PUT',
      path: '/api/v1/models/{name}/version/{version}',
      description: '更新模型版本',
    },
    {
      method: 'DELETE',
      path: '/api/v1/models/{name}/version/{version}',
      description: '删除模型',
    },
    {
      method: 'POST',
      path: '/api/v1/infer',
      description: '执行推理（流式）',
    },
    {
      method: 'GET',
      path: '/api/v1/dashboard',
      description: '获取仪表盘数据',
    },
    {
      method: 'GET',
      path: '/api/v1/metrics',
      description: '获取性能指标',
    },
  ];

  const quickStartSteps = [
    {
      title: '1. 注册模型',
      content: '在模型管理页面点击"注册模型"按钮，填写模型名称、版本和后端类型。',
    },
    {
      title: '2. 等待模型就绪',
      content: '模型注册后会自动加载，状态变为"就绪"后即可使用。',
    },
    {
      title: '3. 测试推理',
      content: '在推理测试页面选择模型，输入问题，点击"开始推理"进行测试。',
    },
    {
      title: '4. 并发测试',
      content: '在并发测试页面可以同时运行多个推理请求，验证系统性能。',
    },
    {
      title: '5. 监控指标',
      content: '在性能指标页面查看系统运行状态和性能数据。',
    },
  ];

  const troubleshootingTips = [
    {
      problem: '模型注册失败',
      solution: '检查模型名称格式是否正确，确保后端类型选择正确。',
    },
    {
      problem: '推理请求超时',
      solution: '检查网络连接，确认API密钥配置正确。',
    },
    {
      problem: '流式输出中断',
      solution: '检查浏览器是否支持EventSource，确保网络连接稳定。',
    },
    {
      problem: '并发测试失败',
      solution: '降低并发数量，检查系统资源使用情况。',
    },
  ];

  return (
    <div>
      <Title level={2}>系统设置</Title>
      <Text type="secondary">
        配置系统参数和查看系统信息
      </Text>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="基本设置" size="small">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={{
                apiTimeout: 30,
                maxConcurrentRequests: 10,
                enableMetrics: true,
                enableLogging: true,
                logLevel: 'info',
              }}
            >
              <Form.Item
                name="apiTimeout"
                label="API超时时间 (秒)"
                rules={[{ required: true, message: '请输入超时时间' }]}
              >
                <Input type="number" min={1} max={300} />
              </Form.Item>

              <Form.Item
                name="maxConcurrentRequests"
                label="最大并发请求数"
                rules={[{ required: true, message: '请输入最大并发数' }]}
              >
                <Input type="number" min={1} max={100} />
              </Form.Item>

              <Form.Item
                name="enableMetrics"
                label="启用性能指标收集"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="enableLogging"
                label="启用详细日志"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="logLevel"
                label="日志级别"
              >
                <Select>
                  <Option value="debug">Debug</Option>
                  <Option value="info">Info</Option>
                  <Option value="warn">Warning</Option>
                  <Option value="error">Error</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    保存设置
                  </Button>
                  <Button onClick={() => form.resetFields()}>
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="系统信息" size="small">
            <List
              size="small"
              dataSource={Object.entries(systemInfo)}
              renderItem={([key, value]) => (
                <List.Item>
                  <Text strong style={{ width: 120 }}>
                    {key === 'version' && '版本'}
                    {key === 'buildTime' && '构建时间'}
                    {key === 'goVersion' && 'Go版本'}
                    {key === 'platform' && '平台'}
                    {key === 'uptime' && '运行时间'}
                    {key === 'memoryUsage' && '内存使用'}
                    {key === 'cpuUsage' && 'CPU使用率'}
                  </Text>
                  <Text>{value}</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="API接口文档" style={{ marginTop: 24 }} size="small">
        <Alert
          message="API基础URL"
          description="http://localhost:8080/api/v1"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <List
          size="small"
          dataSource={apiEndpoints}
          renderItem={(item) => (
            <List.Item>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Tag color={
                  item.method === 'GET' ? 'green' :
                  item.method === 'POST' ? 'blue' :
                  item.method === 'PUT' ? 'orange' :
                  'red'
                } style={{ width: 60, textAlign: 'center' }}>
                  {item.method}
                </Tag>
                <Text code style={{ flex: 1, margin: '0 16px' }}>
                  {item.path}
                </Text>
                <Text type="secondary">{item.description}</Text>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Card title="快速开始指南" style={{ marginTop: 24 }} size="small">
        <List
          size="small"
          dataSource={quickStartSteps}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.title}
                description={item.content}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card title="故障排除" style={{ marginTop: 24 }} size="small">
        <Collapse ghost>
          <Panel header="常见问题解决方案" key="1">
            <List
              size="small"
              dataSource={troubleshootingTips}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Text strong style={{ color: '#ff4d4f' }}>
                        {item.problem}
                      </Text>
                    }
                    description={item.solution}
                  />
                </List.Item>
              )}
            />
          </Panel>
        </Collapse>
      </Card>

      <Card title="功能特性" style={{ marginTop: 24 }} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Card size="small" title="核心功能">
              <ul>
                <li>动态模型注册与管理</li>
                <li>流式推理输出</li>
                <li>模型热更新</li>
                <li>并发请求处理</li>
                <li>实时性能监控</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" title="支持的后端">
              <ul>
                <li>OpenAI API</li>
                <li>Google Gemini</li>
                <li>Mock模拟推理</li>
                <li>可扩展其他后端</li>
              </ul>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="技术栈" style={{ marginTop: 24 }} size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card size="small" title="后端">
              <ul>
                <li>Golang 1.21+</li>
                <li>Gin Web框架</li>
                <li>SSE流式传输</li>
                <li>Prometheus指标</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" title="前端">
              <ul>
                <li>React 18</li>
                <li>Ant Design</li>
                <li>React Query</li>
                <li>Recharts图表</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" title="部署">
              <ul>
                <li>Docker支持</li>
                <li>环境变量配置</li>
                <li>健康检查</li>
                <li>日志管理</li>
              </ul>
            </Card>
          </Col>
        </Row>
      </Card>

      <Divider />

      <Card title="关于" size="small">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Title level={3}>PineAI 多模型托管与推理服务平台</Title>
          <Text type="secondary">
            基于Golang和React构建的现代化AI模型管理平台
          </Text>
          <br />
          <Text type="secondary">
            支持动态模型注册、流式推理、热更新和性能监控
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Settings; 