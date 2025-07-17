import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from 'react-query';
import { useLocation } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Alert,
  Spin,
  Tag,
  Row,
  Col,
  Tooltip,
  message,
} from 'antd';
import {
  SendOutlined,
  StopOutlined,
  ClearOutlined,
  CopyOutlined,
  DownloadOutlined,
  RobotOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { modelAPI, inferenceAPI } from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 状态持久化的key
const STORAGE_KEY = 'inference_test_state';

const Inference = () => {
  const location = useLocation();
  const [form] = Form.useForm();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamOutput, setStreamOutput] = useState('');
  const [currentModel, setCurrentModel] = useState(null);
  const [eventSource, setEventSource] = useState(null);
  const outputRef = useRef(null);

  // 保存状态到localStorage
  const saveState = (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  };

  // 从localStorage恢复状态
  const loadState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load state from localStorage:', error);
    }
    return null;
  };

  // 组件挂载时恢复状态
  useEffect(() => {
    const savedState = loadState();
    if (savedState) {
      setStreamOutput(savedState.streamOutput || '');
      setCurrentModel(savedState.currentModel || null);
      
      // 恢复表单状态
      if (savedState.formData) {
        form.setFieldsValue(savedState.formData);
      }
    }
  }, [form]);

  // 状态变化时保存到localStorage
  useEffect(() => {
    const stateToSave = {
      streamOutput,
      currentModel,
      formData: form.getFieldsValue(),
      timestamp: Date.now()
    };
    saveState(stateToSave);
  }, [streamOutput, currentModel]);

  // 添加调试信息
  useEffect(() => {
    console.log('Inference - Current state:', {
      streamOutput,
      currentModel,
      formData: form.getFieldsValue()
    });
  }, [streamOutput, currentModel]);

  // 添加CSS动画
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const { data: models, isLoading: modelsLoading } = useQuery(
    'models',
    modelAPI.getModels,
    {
      refetchInterval: 3000,
    }
  );

  // 如果有从其他页面传递的模型信息，自动设置
  useEffect(() => {
    if (location.state?.model && !currentModel) {
      const model = location.state.model;
      setCurrentModel(model);
      form.setFieldsValue({
        model: model.name,
        version: model.version,
      });
    }
  }, [location.state, currentModel, form]);

  const handleModelChange = (value) => {
    const model = models?.data?.models?.find(m => m.name === value);
    if (model) {
      setCurrentModel(model);
      form.setFieldsValue({ version: model.version });
      
      // 保存模型选择状态
      const currentState = loadState() || {};
      const newState = {
        ...currentState,
        currentModel: model,
        formData: {
          ...currentState.formData,
          model: value,
          version: model.version
        },
        timestamp: Date.now()
      };
      saveState(newState);
    }
  };

  const handleStartStreaming = async () => {
    try {
      const values = await form.validateFields();
      
      if (!values.input.trim()) {
        message.error('请输入推理内容');
        return;
      }

      setIsStreaming(true);
      setStreamOutput('');

      console.log('Starting inference with values:', values);
      
      const eventSource = inferenceAPI.streamInference(
        values,
        (data) => {
          console.log('Received streaming data:', data);
          if (data.content) {
            console.log('Adding content to output:', data.content);
            // 立即更新状态，实现真正的打字机效果
            setStreamOutput(prev => prev + data.content);
            
            // 立即滚动到底部
            requestAnimationFrame(() => {
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            });
          }
        },
        (error) => {
          console.error('Streaming error:', error);
          message.error('推理过程中发生错误');
          setIsStreaming(false);
        },
        () => {
          console.log('Streaming completed');
          setIsStreaming(false);
          message.success('推理完成');
        }
      );

      setEventSource(eventSource);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleStopStreaming = () => {
    if (eventSource) {
      eventSource.abort();
      setEventSource(null);
    }
    setIsStreaming(false);
    message.info('推理已停止');
  };

  const handleClear = () => {
    setStreamOutput('');
    form.resetFields();
    setCurrentModel(null);
    // 清除localStorage中的状态
    localStorage.removeItem(STORAGE_KEY);
    message.success('已清空所有内容');
  };

  const handleCopy = () => {
    if (streamOutput) {
      navigator.clipboard.writeText(streamOutput);
      message.success('已复制到剪贴板');
    }
  };

  const handleDownload = () => {
    if (streamOutput) {
      const blob = new Blob([streamOutput], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inference-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('文件已下载');
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamOutput]);

  // 调试信息
  console.log('Inference - models:', models);
  console.log('Inference - models.data:', models?.data);
  console.log('Inference - models.data.models:', models?.data?.models);
  console.log('Inference - models.data.models is array:', Array.isArray(models?.data?.models));
  
  const readyModels = models?.data?.models?.filter(m => m.status === 'ready') || [];
  console.log('Inference - readyModels:', readyModels);

  return (
    <div>
      <Title level={2}>推理测试</Title>
      <Text type="secondary">
        测试已注册模型的推理能力，支持流式输出和实时显示
      </Text>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="推理配置" size="small">
            <Form
              form={form}
              layout="vertical"
              disabled={isStreaming}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="model"
                    label="选择模型"
                    rules={[{ required: true, message: '请选择模型' }]}
                  >
                    <Select
                      placeholder="选择模型"
                      onChange={handleModelChange}
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
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="version"
                    label="版本"
                    rules={[{ required: true, message: '请选择版本' }]}
                  >
                    <Select placeholder="选择版本" disabled>
                      {currentModel && (
                        <Option value={currentModel.version}>
                          {currentModel.version}
                        </Option>
                      )}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="input"
                label="推理输入"
                rules={[{ required: true, message: '请输入推理内容' }]}
              >
                <TextArea
                  placeholder="请输入您的问题或指令..."
                  rows={6}
                  showCount
                  maxLength={2000}
                  onChange={(e) => {
                    // 手动保存表单状态
                    const currentState = loadState() || {};
                    const newState = {
                      ...currentState,
                      formData: {
                        ...currentState.formData,
                        input: e.target.value
                      },
                      timestamp: Date.now()
                    };
                    saveState(newState);
                  }}
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleStartStreaming}
                    loading={isStreaming}
                    disabled={!readyModels.length}
                  >
                    {isStreaming ? '推理中...' : '开始推理'}
                  </Button>
                  <Button
                    icon={<StopOutlined />}
                    onClick={handleStopStreaming}
                    disabled={!isStreaming}
                  >
                    停止推理
                  </Button>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={handleClear}
                    disabled={isStreaming}
                  >
                    清空
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            {currentModel && (
              <Alert
                message="当前模型信息"
                description={
                  <div>
                    <p><strong>模型名称:</strong> {currentModel.name}</p>
                    <p><strong>版本:</strong> {currentModel.version}</p>
                    <p><strong>后端类型:</strong> {currentModel.backend_type?.toUpperCase() || 'MOCK'}</p>
                    <p><strong>状态:</strong> 
                      <Tag color="success" style={{ marginLeft: 8 }}>就绪</Tag>
                    </p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}

            {!readyModels.length && !modelsLoading && (
              <Alert
                message="暂无可用模型"
                description="请先在模型管理页面注册模型，或等待模型加载完成。"
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <MessageOutlined />
                推理输出
                {isStreaming && (
                  <div className="streaming-indicator" />
                )}
              </Space>
            }
            size="small"
            extra={
              <Space>
                <Tooltip title="复制输出">
                  <Button
                    icon={<CopyOutlined />}
                    size="small"
                    onClick={handleCopy}
                    disabled={!streamOutput}
                  />
                </Tooltip>
                <Tooltip title="下载输出">
                  <Button
                    icon={<DownloadOutlined />}
                    size="small"
                    onClick={handleDownload}
                    disabled={!streamOutput}
                  />
                </Tooltip>
              </Space>
            }
          >
            <div
              ref={outputRef}
              className="stream-output"
              style={{
                minHeight: '300px',
                maxHeight: '500px',
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
                position: 'relative',
              }}
            >
              <AnimatePresence>
                {streamOutput ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {streamOutput}
                    {isStreaming && (
                      <span 
                        className="streaming-indicator" 
                        style={{ 
                          marginLeft: 4,
                          animation: 'blink 1s infinite',
                          color: '#1890ff',
                          fontWeight: 'bold'
                        }} 
                      >
                        |
                      </span>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ color: '#999', textAlign: 'center', padding: '40px 20px' }}
                  >
                    <MessageOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                    <div>推理输出将在这里显示</div>
                    <div style={{ fontSize: '12px', marginTop: 8 }}>
                      点击"开始推理"按钮开始测试
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isStreaming && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  正在接收流式数据...
                </Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Inference; 