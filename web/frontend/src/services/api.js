import axios from 'axios';

// 在开发环境中使用相对路径，让代理处理
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

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
  
  // 更新模型版本（热更新）
  updateModel: (name, version, modelData) => 
    api.put(`/models/${name}/version/${version}`, modelData),
  
  // 删除模型
  deleteModel: (name, version) => 
    api.delete(`/models/${name}/version/${version}`),
  
  // 获取模型详情
  getModelDetails: (name, version) => 
    api.get(`/models/${name}/version/${version}`),
  
  // 获取模型进程状态
  getModelProcess: (name, version) => 
    api.get(`/models/${name}/version/${version}/process`),
};

// 推理API
export const inferenceAPI = {
  // 流式推理
  streamInference: (data, onMessage, onError, onComplete) => {
    console.log('Starting streaming inference with data:', data);
    
    // 使用POST请求进行流式推理
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/infer`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    let buffer = '';
    let lastProcessedLength = 0;
    let isCompleted = false;
    
    // 使用定时器定期检查数据，确保流式显示
    const checkInterval = setInterval(() => {
      if (xhr.readyState >= 3 && !isCompleted) {
        const currentResponse = xhr.responseText;
        const newData = currentResponse.substring(lastProcessedLength);
        
        if (newData.length > 0) {
          console.log('New data received:', newData);
          lastProcessedLength = currentResponse.length;
          buffer += newData;
          
          // 处理缓冲区中的完整行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的行
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data.trim() && data !== '[DONE]') {
                console.log('Sending data immediately:', data);
                onMessage({ content: data });
              }
            }
          }
        }
      }
      
      // 如果请求完成，清理定时器
      if (xhr.readyState === 4) {
        clearInterval(checkInterval);
        isCompleted = true;
        
        // 处理最后的数据
        if (buffer) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data.trim() && data !== '[DONE]') {
                console.log('Final data:', data);
                onMessage({ content: data });
              }
            }
          }
        }
        
        if (xhr.status === 200) {
          console.log('Calling onComplete');
          onComplete();
        } else {
          console.log('Calling onError with status:', xhr.status);
          onError(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      }
    }, 5); // 每5ms检查一次，实现真正的实时显示
    
    xhr.onerror = function() {
      console.log('XHR error occurred');
      onError(new Error('Network error'));
    };

    xhr.send(JSON.stringify(data));
    return xhr;
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
  
  // 获取进程状态
  getProcesses: () => api.get('/processes'),
};

// 系统API
export const systemAPI = {
  // 健康检查
  health: () => api.get('/health'),
  
  // 获取系统信息
  info: () => api.get('/info'),
  
  // 获取系统配置
  getConfig: () => api.get('/config'),
  
  // 更新系统配置
  updateConfig: (config) => api.put('/config', config),
};

// 进程管理API
export const processAPI = {
  // 获取所有进程
  getAllProcesses: () => api.get('/processes'),
  
  // 启动进程
  startProcess: (name, version) => api.post(`/processes/${name}/version/${version}/start`),
  
  // 停止进程
  stopProcess: (name, version) => api.post(`/processes/${name}/version/${version}/stop`),
  
  // 重启进程
  restartProcess: (name, version) => api.post(`/processes/${name}/version/${version}/restart`),
  
  // 获取进程日志
  getProcessLogs: (name, version) => api.get(`/processes/${name}/version/${version}/logs`),
};

export default api; 