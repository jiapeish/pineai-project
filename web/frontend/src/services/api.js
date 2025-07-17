import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// 模型管理API
export const modelAPI = {
  // 获取模型列表
  getModels: () => api.get('/models'),
  
  // 注册模型
  registerModel: (modelData) => api.post('/models', modelData),
  
  // 更新模型版本
  updateModel: (name, version, modelData) => 
    api.put(`/models/${name}/version/${version}`, modelData),
  
  // 删除模型
  deleteModel: (name, version) => 
    api.delete(`/models/${name}/version/${version}`),
};

// 推理API
export const inferenceAPI = {
  // 流式推理
  streamInference: (data, onMessage, onError, onComplete) => {
    const eventSource = new EventSource(
      `${API_BASE_URL}/infer?model=${data.model}&version=${data.version}&input=${encodeURIComponent(data.input)}`
    );

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      onError(error);
      eventSource.close();
    };

    eventSource.addEventListener('complete', () => {
      onComplete();
      eventSource.close();
    });

    return eventSource;
  },

  // 普通推理（非流式）
  inference: (data) => api.post('/infer', data),
};

// 仪表盘API
export const dashboardAPI = {
  // 获取仪表盘数据
  getDashboard: () => api.get('/dashboard'),
  
  // 获取指标数据
  getMetrics: () => api.get('/metrics'),
};

// 系统API
export const systemAPI = {
  // 健康检查
  health: () => api.get('/health'),
  
  // 获取系统信息
  info: () => api.get('/info'),
};

export default api; 