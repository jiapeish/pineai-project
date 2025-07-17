import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Typography,
  Row,
  Col,
  Alert,
  Spin,
  Tooltip,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { modelAPI, processAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const ModelManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHotUpdateModalVisible, setIsHotUpdateModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [hotUpdateModel, setHotUpdateModel] = useState(null);
  const [form] = Form.useForm();
  const [hotUpdateForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: models, isLoading, error, refetch } = useQuery(
    'models',
    modelAPI.getModels,
    {
      refetchInterval: 3000,
    }
  );

  const { data: processesData } = useQuery(
    'processes',
    processAPI.getAllProcesses,
    {
      refetchInterval: 2000,
    }
  );

  const registerMutation = useMutation(modelAPI.registerModel, {
    onSuccess: () => {
      message.success('模型注册成功！');
      queryClient.invalidateQueries('models');
      queryClient.invalidateQueries('dashboard');
      queryClient.invalidateQueries('processes');
      handleCancel();
    },
    onError: (error) => {
      message.error(`注册失败: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateMutation = useMutation(
    ({ name, version, data }) => modelAPI.updateModel(name, version, data),
    {
      onSuccess: () => {
        message.success('模型更新成功！');
        queryClient.invalidateQueries('models');
        queryClient.invalidateQueries('dashboard');
        queryClient.invalidateQueries('processes');
        handleCancel();
      },
      onError: (error) => {
        message.error(`更新失败: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  const hotUpdateMutation = useMutation(
    ({ name, version, data }) => modelAPI.updateModel(name, version, data),
    {
      onSuccess: () => {
        message.success('热更新成功！新版本正在启动...');
        queryClient.invalidateQueries('models');
        queryClient.invalidateQueries('dashboard');
        queryClient.invalidateQueries('processes');
        handleHotUpdateCancel();
      },
      onError: (error) => {
        message.error(`热更新失败: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  const deleteMutation = useMutation(
    ({ name, version }) => modelAPI.deleteModel(name, version),
    {
      onSuccess: () => {
        message.success('模型删除成功！');
        queryClient.invalidateQueries('models');
        queryClient.invalidateQueries('dashboard');
        queryClient.invalidateQueries('processes');
      },
      onError: (error) => {
        message.error(`删除失败: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  const startProcessMutation = useMutation(
    ({ name, version }) => processAPI.startProcess(name, version),
    {
      onSuccess: () => {
        message.success('进程启动成功！');
        queryClient.invalidateQueries('processes');
        queryClient.invalidateQueries('models');
      },
      onError: (error) => {
        message.error(`启动失败: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  const stopProcessMutation = useMutation(
    ({ name, version }) => processAPI.stopProcess(name, version),
    {
      onSuccess: () => {
        message.success('进程停止成功！');
        queryClient.invalidateQueries('processes');
        queryClient.invalidateQueries('models');
      },
      onError: (error) => {
        message.error(`停止失败: ${error.response?.data?.message || error.message}`);
      },
    }
  );

  const handleAdd = () => {
    setEditingModel(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingModel(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleHotUpdate = (record) => {
    setHotUpdateModel(record);
    hotUpdateForm.setFieldsValue({
      name: record.name,
      old_version: record.version,
      new_version: '',
      backend_type: record.backend_type,
      description: record.description,
    });
    setIsHotUpdateModalVisible(true);
  };

  const handleDelete = (name, version) => {
    deleteMutation.mutate({ name, version });
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingModel(null);
    form.resetFields();
  };

  const handleHotUpdateCancel = () => {
    setIsHotUpdateModalVisible(false);
    setHotUpdateModel(null);
    hotUpdateForm.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingModel) {
        updateMutation.mutate({
          name: editingModel.name,
          version: editingModel.version,
          data: values,
        });
      } else {
        registerMutation.mutate(values);
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleHotUpdateSubmit = async () => {
    try {
      const values = await hotUpdateForm.validateFields();
      hotUpdateMutation.mutate({
        name: values.name,
        version: values.old_version, // 这里要用旧版本号
        data: {
          new_version: values.new_version, // 这里要加新版本号
          backend_type: values.backend_type,
          description: values.description,
          api_key: values.api_key,
          base_url: values.base_url,
          model_name: values.name, // 确保 model_name 传递
          max_tokens: values.max_tokens || 1000, // 默认1000
          temperature: values.temperature || 0.7, // 默认0.7
        },
      });
    } catch (error) {
      console.error('Hot update form validation failed:', error);
    }
  };

  const getProcessStatus = (modelName, version) => {
    if (!processesData?.data?.processes) return null;
    return processesData.data.processes.find(
      p => p.model_name === modelName && p.version === version
    );
  };

  const columns = [
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
      render: (text) => {
        const colorMap = {
          openai: 'green',
          gemini: 'purple',
          mock: 'orange',
        };
        return (
          <Tag color={colorMap[text] || 'default'}>
            {text?.toUpperCase() || 'MOCK'}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const process = getProcessStatus(record.name, record.version);
        const statusConfig = {
          ready: { color: 'success', text: '就绪' },
          loading: { color: 'processing', text: '加载中' },
          error: { color: 'error', text: '错误' },
          stopped: { color: 'default', text: '已停止' },
          unloaded: { color: 'default', text: '已卸载' },
          deprecated: { color: 'warning', text: '已废弃' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        
        return (
          <Space>
            <Tag color={config.color}>{config.text}</Tag>
            {process && (
              <Badge 
                status={process.status === 'running' ? 'success' : 'default'} 
                text={`PID: ${process.pid}`} 
              />
            )}
          </Space>
        );
      },
    },
    {
      title: '进程端口',
      key: 'port',
      render: (_, record) => {
        const process = getProcessStatus(record.name, record.version);
        return process?.port ? <Tag color="cyan">{process.port}</Tag> : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const process = getProcessStatus(record.name, record.version);
        const isRunning = process?.status === 'running';
        
        return (
          <Space>
            <Tooltip title="热更新">
              <Button
                type="link"
                icon={<RocketOutlined />}
                onClick={() => handleHotUpdate(record)}
                disabled={record.status === 'loading'}
              />
            </Tooltip>
            <Tooltip title={isRunning ? "停止进程" : "启动进程"}>
              <Button
                type="link"
                icon={isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => {
                  if (isRunning) {
                    stopProcessMutation.mutate({ name: record.name, version: record.version });
                  } else {
                    startProcessMutation.mutate({ name: record.name, version: record.version });
                  }
                }}
                loading={startProcessMutation.isLoading || stopProcessMutation.isLoading}
              />
            </Tooltip>
            <Tooltip title="编辑模型">
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                disabled={record.status === 'loading'}
              />
            </Tooltip>
            <Popconfirm
              title="确定要删除这个模型吗？"
              description="删除后无法恢复，请谨慎操作。"
              onConfirm={() => handleDelete(record.name, record.version)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除模型">
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={record.status === 'loading'}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

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

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2}>模型管理</Title>
          <Text type="secondary">
            管理已注册的模型，支持动态注册、热更新和进程管理
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              注册模型
            </Button>
          </Space>
        </Col>
      </Row>

      <Card>
        <AnimatePresence>
          {models?.data?.models && models.data.models.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Table
                columns={columns}
                dataSource={models?.data?.models || []}
                rowKey={(record) => `${record.name}-${record.version}`}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) =>
                    `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'center', padding: '60px 20px' }}
            >
              <div style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }}>
                🤖
              </div>
              <Title level={4} style={{ color: '#999' }}>
                暂无模型
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                点击下方按钮注册您的第一个模型
              </Text>
              <Button type="primary" size="large" onClick={handleAdd}>
                注册模型
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* 注册/编辑模型模态框 */}
      <Modal
        title={editingModel ? '编辑模型' : '注册模型'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={registerMutation.isLoading || updateMutation.isLoading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            backend_type: 'mock',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="模型名称"
                rules={[
                  { required: true, message: '请输入模型名称' },
                  { pattern: /^[a-zA-Z0-9._-]+$/, message: '模型名称只能包含字母、数字、小数点、下划线和连字符' },
                ]}
              >
                <Input placeholder="例如: gpt-4o" disabled={!!editingModel} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="version"
                label="版本"
                rules={[
                  { required: true, message: '请输入版本号' },
                  { pattern: /^[a-zA-Z0-9._-]+$/, message: '版本号格式不正确' },
                ]}
              >
                <Input placeholder="例如: v1.0" disabled={!!editingModel} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="backend_type"
            label={
              <Space>
                后端类型
                <Tooltip title="选择模型的后端服务类型">
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请选择后端类型' }]}
          >
            <Select placeholder="选择后端类型">
              <Option value="mock">Mock (模拟推理)</Option>
              <Option value="openai">OpenAI API</Option>
              <Option value="gemini">Google Gemini</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API密钥"
            rules={[
              { 
                required: true, 
                message: '请输入API密钥',
                validator: (_, value) => {
                  if (form.getFieldValue('backend_type') !== 'mock' && !value) {
                    return Promise.reject(new Error('请输入API密钥'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input.Password placeholder="输入API密钥" />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="基础URL"
          >
            <Input placeholder="例如: https://api.openai.com/v1 (可选)" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              placeholder="模型描述（可选）"
              rows={3}
            />
          </Form.Item>

          {editingModel && (
            <Alert
              message="编辑提示"
              description="编辑模型时，模型名称和版本号不可修改。如需修改，请先删除当前模型再重新注册。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
        </Form>
      </Modal>

      {/* 热更新模态框 */}
      <Modal
        title="热更新模型"
        open={isHotUpdateModalVisible}
        onOk={handleHotUpdateSubmit}
        onCancel={handleHotUpdateCancel}
        confirmLoading={hotUpdateMutation.isLoading}
        width={600}
      >
        <Alert
          message="热更新说明"
          description="热更新将创建新版本模型，旧版本进程将在新版本就绪后自动停止。已有连接不会中断。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Form
          form={hotUpdateForm}
          layout="vertical"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="模型名称"
              >
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="old_version"
                label="当前版本"
              >
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="new_version"
            label="新版本"
            rules={[
              { required: true, message: '请输入新版本号' },
              { pattern: /^[a-zA-Z0-9._-]+$/, message: '版本号格式不正确' },
            ]}
          >
            <Input placeholder="例如: v2.0" />
          </Form.Item>

          <Form.Item
            name="backend_type"
            label="后端类型"
            rules={[{ required: true, message: '请选择后端类型' }]}
          >
            <Select placeholder="选择后端类型">
              <Option value="mock">Mock (模拟推理)</Option>
              <Option value="openai">OpenAI API</Option>
              <Option value="gemini">Google Gemini</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API密钥"
            rules={[
              { 
                required: true, 
                message: '请输入API密钥',
                validator: (_, value) => {
                  if (hotUpdateForm.getFieldValue('backend_type') !== 'mock' && !value) {
                    return Promise.reject(new Error('请输入API密钥'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input.Password placeholder="输入API密钥" />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="基础URL"
          >
            <Input placeholder="例如: https://api.openai.com/v1 (可选)" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea
              placeholder="模型描述（可选）"
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelManagement; 