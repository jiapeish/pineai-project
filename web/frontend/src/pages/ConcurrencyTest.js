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
  MessageOutlined,
  CloseOutlined,
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

  // 移除自动创建标签页的逻辑，现在根据并发数量动态创建

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
    console.log('Starting concurrency test...');
    console.log('Selected model:', selectedModel);
    console.log('Test input:', testInput);
    console.log('Concurrent count:', concurrentCount);
    
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

    // 根据并发数量创建或调整测试标签页
    const newTestTabs = [];
    for (let i = 0; i < concurrentCount; i++) {
      if (i < testTabs.length) {
        // 重用现有的标签页，但重置状态
        newTestTabs.push({
          ...testTabs[i],
          content: '',
          isStreaming: false,
          startTime: null,
          endTime: null,
          responseTime: 0,
          status: 'idle',
        });
      } else {
        // 创建新的标签页
        newTestTabs.push({
          key: `tab-${Date.now()}-${i}`,
          title: `测试 ${i + 1}`,
          content: '',
          isStreaming: false,
          startTime: null,
          endTime: null,
          responseTime: 0,
          status: 'idle',
        });
      }
    }
    
    console.log('Created test tabs:', newTestTabs);
    setTestTabs(newTestTabs);

    // 并发执行测试
    const promises = [];
    for (let i = 0; i < concurrentCount; i++) {
      console.log(`Adding test ${i + 1} to promises`);
      promises.push(runSingleTest(newTestTabs[i].key, i));
    }

    console.log(`Starting ${promises.length} concurrent tests`);

    try {
      await Promise.all(promises);
      console.log('All tests completed');
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
      console.log(`Starting test ${index + 1} with tabKey: ${tabKey}`);
      const startTime = Date.now();
      
      // 更新标签页状态
      setTestTabs(prev => {
        console.log(`Updating tab ${tabKey} to running state`);
        return prev.map(tab => 
          tab.key === tabKey 
            ? { ...tab, isStreaming: true, startTime, status: 'running' }
            : tab
        );
      });

      // 更新测试结果
      setTestResults(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
      }));

      console.log(`Calling inference API for test ${index + 1}`);
      const xhr = inferenceAPI.streamInference(
        {
          model: selectedModel.name,
          version: selectedModel.version,
          input: `${testInput} (并发测试 #${index + 1})`,
        },
        (data) => {
          console.log(`Test ${index + 1} received data:`, data);
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
          console.log(`Test ${index + 1} completed successfully`);
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
        console.log(`Test ${index + 1} timeout reached`);
        if (xhr && xhr.abort) {
          xhr.abort();
        }
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
        title="测试结果详情" 
        style={{ marginTop: 24 }}
        size="small"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={clearAllResults}>
              清空结果
            </Button>
          </Space>
        }
      >
        {testTabs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <MessageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
            <div style={{ marginTop: 16, color: '#999' }}>
              点击"开始并发测试"开始测试，结果将在这里显示
            </div>
          </div>
        ) : (
          <Row gutter={[16, 16]}>
            {testTabs.map(tab => (
              <Col xs={24} sm={12} lg={8} key={tab.key}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <span>{tab.title}</span>
                      <Tag color={getStatusColor(tab.status)}>
                        {getStatusText(tab.status)}
                      </Tag>
                      {tab.isStreaming && <div className="streaming-indicator" />}
                    </Space>
                  }
                  extra={
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => removeTestTab(tab.key)}
                    />
                  }
                >
                  <div
                    ref={(el) => (testRefs.current[tab.key] = el)}
                    className="stream-output"
                    style={{
                      minHeight: '150px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '6px',
                      padding: '12px',
                      fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                      fontSize: '12px',
                      lineHeight: '1.4',
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
              </Card>
            </Col>
          ))}
        </Row>
        )}
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