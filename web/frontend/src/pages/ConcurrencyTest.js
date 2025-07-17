import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import {
  Card,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Row,
  Col,
  Tabs,
  Tag,
  Alert,
  message,
  Divider,
  Statistic,
  Progress,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  PlusOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  FireOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { modelAPI, inferenceAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const ConcurrencyTest = () => {
  const [testTabs, setTestTabs] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState('1');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    startTime: null,
    endTime: null,
  });
  const [selectedModel, setSelectedModel] = useState(null);
  const [testInput, setTestInput] = useState('Tell me a joke');
  const [concurrentCount, setConcurrentCount] = useState(3);
  const [testDurationSeconds, setTestDurationSeconds] = useState(30);
  const testRefs = useRef({});

  const { data: models, isLoading: modelsLoading } = useQuery(
    'models',
    modelAPI.getModels,
    {
      refetchInterval: 3000,
    }
  );

  const readyModels = models?.data?.models?.filter(m => m.status === 'ready') || [];

  useEffect(() => {
    // 初始化第一个测试标签页
    if (testTabs.length === 0) {
      addTestTab();
    }
  }, [testTabs.length]); // 修复依赖项

  const addTestTab = () => {
    const newTabKey = `tab-${Date.now()}`;
    const newTab = {
      key: newTabKey,
      title: `测试 ${testTabs.length + 1}`,
      content: '',
      isStreaming: false,
      startTime: null,
      endTime: null,
      responseTime: 0,
      status: 'idle', // idle, running, success, error
    };

    setTestTabs(prev => [...prev, newTab]);
    setActiveTabKey(newTabKey);
  };

  const removeTestTab = (targetKey) => {
    const newTabs = testTabs.filter(tab => tab.key !== targetKey);
    setTestTabs(newTabs);
    
    if (newTabs.length === 0) {
      addTestTab();
    } else if (activeTabKey === targetKey) {
      setActiveTabKey(newTabs[0].key);
    }
  };

  const startConcurrencyTest = async () => {
    if (!selectedModel) {
      message.error('请选择要测试的模型');
      return;
    }

    if (!testInput.trim()) {
      message.error('请输入测试内容');
      return;
    }

    setIsRunning(true);
    setTestResults({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      startTime: Date.now(),
      endTime: null,
    });

    // 重置所有标签页状态
    setTestTabs(prev => prev.map(tab => ({
      ...tab,
      content: '',
      isStreaming: false,
      startTime: null,
      endTime: null,
      responseTime: 0,
      status: 'idle',
    })));

    // 并发执行测试
    const promises = [];
    for (let i = 0; i < concurrentCount; i++) {
      if (i < testTabs.length) {
        promises.push(runSingleTest(testTabs[i].key, i));
      }
    }

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Concurrency test error:', error);
    }

    setIsRunning(false);
    setTestResults(prev => ({
      ...prev,
      endTime: Date.now(),
    }));

    message.success('并发测试完成！');
  };

  const runSingleTest = async (tabKey, index) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // 更新标签页状态
      setTestTabs(prev => prev.map(tab => 
        tab.key === tabKey 
          ? { ...tab, isStreaming: true, startTime, status: 'running' }
          : tab
      ));

      // 更新测试结果
      setTestResults(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
      }));

      const eventSource = inferenceAPI.streamInference(
        {
          model: selectedModel.name,
          version: selectedModel.version,
          input: `${testInput} (并发测试 #${index + 1})`,
        },
        (data) => {
          if (data.content) {
            setTestTabs(prev => prev.map(tab => 
              tab.key === tabKey 
                ? { ...tab, content: tab.content + data.content }
                : tab
            ));
          }
        },
        (error) => {
          console.error(`Test ${index + 1} error:`, error);
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          setTestTabs(prev => prev.map(tab => 
            tab.key === tabKey 
              ? { 
                  ...tab, 
                  isStreaming: false, 
                  endTime, 
                  responseTime, 
                  status: 'error',
                  content: tab.content + `\n[错误] ${error.message || '推理失败'}`
                }
              : tab
          ));

          setTestResults(prev => ({
            ...prev,
            failedRequests: prev.failedRequests + 1,
          }));

          resolve();
        },
        () => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          setTestTabs(prev => prev.map(tab => 
            tab.key === tabKey 
              ? { 
                  ...tab, 
                  isStreaming: false, 
                  endTime, 
                  responseTime, 
                  status: 'success'
                }
              : tab
          ));

          setTestResults(prev => ({
            ...prev,
            successfulRequests: prev.successfulRequests + 1,
            averageResponseTime: (prev.averageResponseTime * (prev.successfulRequests + prev.failedRequests - 1) + responseTime) / (prev.successfulRequests + prev.failedRequests),
          }));

          resolve();
        }
      );

             // 设置超时
       setTimeout(() => {
         eventSource.close();
         resolve();
       }, testDurationSeconds * 1000);
    });
  };

  const stopAllTests = () => {
    setIsRunning(false);
    setTestTabs(prev => prev.map(tab => ({
      ...tab,
      isStreaming: false,
      status: tab.status === 'running' ? 'idle' : tab.status,
    })));
    message.info('已停止所有测试');
  };

  const clearAllResults = () => {
    setTestTabs(prev => prev.map(tab => ({
      ...tab,
      content: '',
      startTime: null,
      endTime: null,
      responseTime: 0,
      status: 'idle',
    })));
    setTestResults({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      startTime: null,
      endTime: null,
    });
  };

  const getStatusColor = (status) => {
    const colorMap = {
      idle: 'default',
      running: 'processing',
      success: 'success',
      error: 'error',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const textMap = {
      idle: '空闲',
      running: '运行中',
      success: '成功',
      error: '失败',
    };
    return textMap[status] || status;
  };

  const successRate = testResults.totalRequests > 0 
    ? (testResults.successfulRequests / testResults.totalRequests) * 100 
    : 0;

  const actualTestDuration = testResults.startTime && testResults.endTime 
    ? (testResults.endTime - testResults.startTime) / 1000 
    : 0;

  return (
    <div>
      <Title level={2}>并发测试</Title>
      <Text type="secondary">
        测试模型的并发处理能力，支持多标签页同时测试和热更新验证
      </Text>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={8}>
          <Card title="测试配置" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>选择模型:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="选择要测试的模型"
                  value={selectedModel?.name}
                  onChange={(value) => {
                    const model = readyModels.find(m => m.name === value);
                    setSelectedModel(model);
                  }}
                  loading={modelsLoading}
                >
                  {readyModels.map(model => (
                    <Option key={model.name} value={model.name}>
                      <Space>
                        <RobotOutlined />
                        {model.name}
                        <Tag size="small" color="blue">{model.version}</Tag>
                        <Tag size="small" color={
                          model.backend_type === 'openai' ? 'green' : 
                          model.backend_type === 'gemini' ? 'purple' : 'orange'
                        }>
                          {model.backend_type?.toUpperCase() || 'MOCK'}
                        </Tag>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </div>

              <div>
                <Text strong>测试内容:</Text>
                <TextArea
                  style={{ marginTop: 8 }}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="输入测试内容"
                  rows={3}
                />
              </div>

              <div>
                <Text strong>并发数量:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={concurrentCount}
                  onChange={setConcurrentCount}
                >
                  <Option value={1}>1 个并发</Option>
                  <Option value={3}>3 个并发</Option>
                  <Option value={5}>5 个并发</Option>
                  <Option value={10}>10 个并发</Option>
                </Select>
              </div>

                             <div>
                 <Text strong>测试时长 (秒):</Text>
                 <Select
                   style={{ width: '100%', marginTop: 8 }}
                   value={testDurationSeconds}
                   onChange={setTestDurationSeconds}
                 >
                  <Option value={10}>10 秒</Option>
                  <Option value={30}>30 秒</Option>
                  <Option value={60}>60 秒</Option>
                  <Option value={120}>120 秒</Option>
                </Select>
              </div>

              <Space style={{ width: '100%', justifyContent: 'center' }}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={startConcurrencyTest}
                  loading={isRunning}
                  disabled={!selectedModel || !testInput.trim()}
                >
                  {isRunning ? '测试中...' : '开始并发测试'}
                </Button>
                <Button
                  icon={<StopOutlined />}
                  onClick={stopAllTests}
                  disabled={!isRunning}
                >
                  停止测试
                </Button>
              </Space>
            </Space>

            {selectedModel && (
              <Alert
                message="当前测试模型"
                description={
                  <div>
                    <p><strong>模型:</strong> {selectedModel.name}</p>
                    <p><strong>版本:</strong> {selectedModel.version}</p>
                    <p><strong>后端:</strong> {selectedModel.backend_type?.toUpperCase() || 'MOCK'}</p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card 
            title="测试结果统计" 
            size="small"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={clearAllResults}>
                  清空结果
                </Button>
                <Button icon={<PlusOutlined />} onClick={addTestTab}>
                  添加标签页
                </Button>
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="总请求数"
                  value={testResults.totalRequests}
                  prefix={<FireOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="成功请求"
                  value={testResults.successfulRequests}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="失败请求"
                  value={testResults.failedRequests}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="平均响应时间"
                  value={testResults.averageResponseTime}
                  suffix="ms"
                  prefix={<ClockCircleOutlined />}
                  precision={0}
                />
              </Col>
            </Row>

            <Divider />

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div>
                  <Text>成功率</Text>
                  <Progress
                    percent={successRate}
                    status={successRate >= 90 ? 'success' : successRate >= 70 ? 'normal' : 'exception'}
                    format={(percent) => `${percent.toFixed(1)}%`}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <Text>测试时长</Text>
                                     <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                     {actualTestDuration.toFixed(1)}s
                   </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card 
        title="并发测试标签页" 
        style={{ marginTop: 24 }}
        size="small"
      >
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          type="editable-card"
          onEdit={(targetKey, action) => {
            if (action === 'add') {
              addTestTab();
            } else if (action === 'remove') {
              removeTestTab(targetKey);
            }
          }}
        >
          {testTabs.map(tab => (
            <TabPane
              tab={
                <Space>
                  <span>{tab.title}</span>
                  <Tag color={getStatusColor(tab.status)}>
                    {getStatusText(tab.status)}
                  </Tag>
                  {tab.isStreaming && <div className="streaming-indicator" />}
                </Space>
              }
              key={tab.key}
            >
              <div style={{ position: 'relative' }}>
                <div
                  ref={(el) => (testRefs.current[tab.key] = el)}
                  className="stream-output"
                  style={{
                    minHeight: '200px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '6px',
                    padding: '16px',
                    fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                  }}
                >
                  <AnimatePresence>
                    {tab.content ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {tab.content}
                        {tab.isStreaming && (
                          <span className="streaming-indicator" style={{ marginLeft: 4 }} />
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}
                      >
                        <ExperimentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                        <div>等待测试开始...</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {tab.responseTime > 0 && (
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Text type="secondary">
                      响应时间: {tab.responseTime}ms
                    </Text>
                  </div>
                )}
              </div>
            </TabPane>
          ))}
        </Tabs>
      </Card>

      <Card title="热更新测试说明" size="small" style={{ marginTop: 24 }}>
        <Paragraph>
          <ul>
            <li>在并发测试过程中，可以切换到模型管理页面修改模型配置</li>
            <li>新请求将使用更新后的模型配置，而正在进行的请求不受影响</li>
            <li>通过观察不同标签页的响应差异，可以验证热更新功能</li>
            <li>建议在测试过程中尝试修改模型的后端类型或配置参数</li>
            <li>并发测试可以验证系统的稳定性和性能表现</li>
          </ul>
        </Paragraph>
      </Card>
    </div>
  );
};

export default ConcurrencyTest; 