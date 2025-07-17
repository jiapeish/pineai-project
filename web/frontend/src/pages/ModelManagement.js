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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { modelAPI } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const ModelManagement = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: models, isLoading, error, refetch } = useQuery(
    'models',
    modelAPI.getModels,
    {
      refetchInterval: 3000,
    }
  );

  const registerMutation = useMutation(modelAPI.registerModel, {
    onSuccess: () => {
      message.success('模型注册成功！');
      queryClient.invalidateQueries('models');
      queryClient.invalidateQueries('dashboard');
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
        handleCancel();
      },
      onError: (error) => {
        message.error(`更新失败: ${error.response?.data?.message || error.message}`);
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
      },
      onError: (error) => {
        message.error(`删除失败: ${error.response?.data?.message || error.message}`);
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

  const handleDelete = (name, version) => {
    deleteMutation.mutate({ name, version });
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingModel(null);
    form.resetFields();
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
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
      ),
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
            管理已注册的模型，支持动态注册、更新和删除
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
          {models && models.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Table
                columns={columns}
                dataSource={models}
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
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: '模型名称只能包含字母、数字、下划线和连字符' },
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
    </div>
  );
};

export default ModelManagement; 