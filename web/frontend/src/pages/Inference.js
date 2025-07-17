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
  Divider,
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

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const Inference = () => {
  const location = useLocation();
  const [form] = Form.useForm();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamOutput, setStreamOutput] = useState('');
  const [currentModel, setCurrentModel] = useState(null);
  const [eventSource, setEventSource] = useState(null);
  const outputRef = useRef(null);

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
    const model = models?.find(m => m.name === value);
    if (model) {
      setCurrentModel(model);
      form.setFieldsValue({ version: model.version });
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

      const eventSource = inferenceAPI.streamInference(
        values,
        (data) => {
          if (data.content) {
            setStreamOutput(prev => prev + data.content);
          }
        },
        (error) => {
          console.error('Streaming error:', error);
          message.error('推理过程中发生错误');
          setIsStreaming(false);
        },
        () => {
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
      eventSource.close();
      setEventSource(null);
    }
    setIsStreaming(false);
    message.info('推理已停止');
  };

  const handleClear = () => {
    setStreamOutput('');
    form.resetFields();
    setCurrentModel(null);
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

  const readyModels = models?.filter(m => m.status === 'ready') || [];

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
                      <span className="streaming-indicator" style={{ marginLeft: 4 }} />
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

      <Divider />

      <Card title="使用说明" size="small">
        <Paragraph>
          <ul>
            <li>选择已注册且状态为"就绪"的模型进行推理测试</li>
            <li>支持流式输出，可以实时查看推理过程</li>
            <li>可以随时停止推理过程</li>
            <li>支持复制和下载推理结果</li>
            <li>推理过程中可以切换到其他页面，不会影响当前推理</li>
          </ul>
        </Paragraph>
      </Card>
    </div>
  );
};

export default Inference; 