# PineAI - 多模型托管与推理服务平台

基于Golang和React构建的现代化AI模型管理平台，支持动态模型注册与更新，并对接第三方LLM实现流式响应。

## 🚀 核心特性

- ✅ **模型注册与管理** - 支持动态注册、查看、更新模型
- ✅ **流式推理API** - 使用SSE协议实现流式响应
- ✅ **热更新机制** - 模型更新不影响现有连接
- ✅ **多后端支持** - 支持OpenAI、Gemini、Mock后端
- ✅ **并发安全** - 使用读写锁和原子操作保证线程安全
- ✅ **资源管理** - 自动清理废弃模型，避免内存泄漏
- ✅ **进程管理** - 独立进程运行，支持启动/停止/重启
- ✅ **前端管理** - 完整的Web管理界面

## 🏗️ 技术架构

### 技术选型
- **Web框架**: Gin (轻量级、高性能)
- **流式协议**: Server-Sent Events (SSE) - 比WebSocket更适合单向数据推送
- **并发控制**: sync.RWMutex + atomic操作
- **热更新**: 进程隔离 + 版本化模型实例
- **进程管理**: 独立Golang进程 + HTTP通信
- **前端框架**: React + Ant Design + React Query



## 🚀 快速开始

### 方法一：一键启动（推荐）

```bash
# 启动所有服务
./start.sh

# 停止所有服务
./stop.sh
```

### 方法二：手动启动

#### 1. 启动后端服务

##### 安装Go依赖
```bash
go mod tidy
```

##### 配置API密钥
在 `config/config.yaml` 中配置真实的API密钥：
```yaml
api_keys:
  openai:
    key: "your-openai-api-key"
  gemini:
    key: "your-gemini-api-key"
```

##### 构建服务
```bash
# 构建主服务和模型进程
./build.sh
```

##### 启动后端
```bash
# 使用构建的可执行文件
./build/pineai-server

# 或者直接运行
go run cmd/server/main.go
```

后端服务将在 `http://localhost:8080` 启动

##### 健康检查
```bash
curl http://localhost:8080/api/v1/health
```

#### 2. 启动前端应用

##### 安装Node.js依赖
```bash
cd web/frontend
npm install
```

##### 启动前端开发服务器
```bash
npm start
```

前端应用将在 `http://localhost:3000` 启动，自动代理到后端API

#### 3. 访问应用

- **前端管理界面**: http://localhost:3000
- **后端API**: http://localhost:8080
- **API数据**: http://localhost:8080/api/v1/dashboard
- **性能指标**: http://localhost:8080/metrics

## 📖 API 使用指南

### 1. 注册模型

#### 注册OpenAI模型
```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpt-3.5",
    "version": "v1",
    "backend_type": "openai",
    "api_key": "your-openai-api-key",
    "base_url": "https://api.openai.com/v1",
    "description": "GPT-3.5 Turbo模型"
  }'
```

#### 注册Gemini模型
```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gemini-pro",
    "version": "v1",
    "backend_type": "gemini",
    "api_key": "your-gemini-api-key",
    "description": "Google Gemini Pro模型"
  }'
```


### 2. 查看模型列表
```bash
curl http://localhost:8080/api/v1/models
```

### 3. 流式推理
```bash
curl -X POST http://localhost:8080/api/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5",
    "version": "v1",
    "input": "Tell me a joke"
  }' \
  --no-buffer
```

### 4. 热更新模型
```bash
curl -X PUT http://localhost:8080/api/v1/models/gpt-3.5/version/v2 \
  -H "Content-Type: application/json" \
  -d '{
    "backend_type": "openai",
    "api_key": "your-openai-api-key",
    "base_url": "https://api.openai.com/v1",
    "description": "GPT-3.5 Turbo模型 v2"
  }'
```

### 5. 删除模型
```bash
curl -X DELETE http://localhost:8080/api/v1/models/gpt-3.5/version/v1
```

### 6. 查看模型进程
```bash
curl http://localhost:8080/api/v1/processes
```

### 7. 启动/停止进程
```bash
# 启动进程
curl -X POST http://localhost:8080/api/v1/processes/gpt-3.5/version/v1/start

# 停止进程
curl -X POST http://localhost:8080/api/v1/processes/gpt-3.5/version/v1/stop
```

### 8. 查看进程统计
```bash
curl http://localhost:8080/api/v1/stats
```

## 🔧 配置说明

### 环境变量
- `PORT`: 服务端口 (默认: 8080)

### 模型配置参数
- `backend_type`: 后端类型 (openai/gemini/mock)
- `api_key`: API密钥 (默认使用配置文件中的密钥)
- `base_url`: 自定义API地址 (可选)
- `model_name`: 模型名称
- `max_tokens`: 最大输出token数
- `temperature`: 温度参数 (0-1)

### 配置文件
API密钥存储在 `config/config.yaml` 文件中：
```yaml
api_keys:
  openai:
    key: "your-openai-api-key"
  gemini:
    key: "your-gemini-api-key"
```

## 🧪 测试示例

```bash
./test/core_features_test.sh

./test/hot_update_test.sh

```

## 📊 Self Report

- **总耗时**: 7 小时
- **实际做题时间段**: 14:00 ~ 18:00，21:00-23:50
- **完成情况**:
  - [x] 模型注册 / 更新 / 查看
  - [x] 流式推理接口
  - [x] 热更新不影响已有连接
  - [x] 独立模型进程管理
  - [x] 进程隔离和资源管理
  - [x] 多后端支持 (OpenAI + Gemini + Mock)
  - [x] Prometheus metrics
  - [x] React前端界面
  - [x] 并发测试功能
  - [x] 进程管理功能
  - [x] 模型热重启与资源回收机制
  - [ ] 多版本分流
  - [ ] 灰度发布
- **备注说明**:
  - 实现了真正的模型进程隔离架构，每个模型运行在独立Golang进程中
  - 支持热更新：新进程启动后，新请求路由到新进程，旧进程继续服务现有连接
  - 自动端口分配和进程生命周期管理
  - 支持OpenAI和Gemini真实API
  - 完整的React前端管理界面
  - 下一步可优化：支持更多后端类型，实现负载均衡和故障转移，多版本分流，Pod化之后实现灰度发布

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License
