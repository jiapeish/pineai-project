# PineAI Backend - 多模型托管与推理服务平台

基于Golang和Gin框架实现的多模型托管与推理服务平台，支持动态模型注册与更新，并对接第三方LLM实现流式响应。

## 🚀 核心特性

- ✅ **模型注册与管理** - 支持动态注册、查看、更新模型
- ✅ **流式推理API** - 使用SSE协议实现流式响应
- ✅ **热更新机制** - 模型更新不影响现有连接
- ✅ **多后端支持** - 支持OpenAI、Gemini、Mock后端
- ✅ **并发安全** - 使用读写锁和原子操作保证线程安全
- ✅ **资源管理** - 自动清理废弃模型，避免内存泄漏

## 🏗️ 技术架构

### 技术选型
- **Web框架**: Gin (轻量级、高性能)
- **流式协议**: Server-Sent Events (SSE) - 比WebSocket更适合单向数据推送
- **并发控制**: sync.RWMutex + atomic操作
- **热更新**: 版本化模型实例 + 引用计数

### 项目结构
```
pineai-project/
├── cmd/server/          # 主程序入口
├── internal/
│   ├── handler/         # HTTP处理器
│   ├── model/           # 模型定义和状态管理
│   ├── registry/        # 模型注册表
│   └── streamer/        # 流式推理器
├── pkg/                 # 公共包
├── go.mod              # 依赖管理
└── README.md           # 项目文档
```

## 🚀 快速开始

### 1. 安装依赖
```bash
go mod tidy
```

### 2. 启动服务
在config/config.yaml里填充真实的API-KEY

```bash
go run cmd/server/main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 健康检查
```bash
curl http://localhost:8080/api/v1/health
```

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
    "config": {
      "backend_type": "openai",
      "model_name": "gpt-3.5-turbo",
      "max_tokens": 1000,
      "temperature": 0.7
    }
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
    "config": {
      "backend_type": "gemini",
      "model_name": "models/gemini-pro",
      "max_tokens": 1000,
      "temperature": 0.7
    }
  }'
```

#### 注册Mock模型（用于测试）
```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mock-model",
    "version": "v1",
    "backend_type": "mock",
    "config": {
      "backend_type": "mock"
    }
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
curl -X PUT http://localhost:8080/api/v1/models/gpt-3.5/version/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "backend_type": "openai",
      "model_name": "gpt-4",
      "max_tokens": 2000,
      "temperature": 0.5
    }
  }'
```

### 5. 删除模型
```bash
curl -X DELETE http://localhost:8080/api/v1/models/gpt-3.5/version/v1
```

## 🔧 配置说明

### 环境变量
- `PORT`: 服务端口 (默认: 8080)

### 模型配置参数
- `backend_type`: 后端类型 (openai/gemini/mock)
- `api_key`: API密钥 (可选，默认使用配置文件中的密钥)
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

### 1. 使用Mock模型测试
```bash
# 注册Mock模型
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-model",
    "version": "v1",
    "backend_type": "mock"
  }'

# 测试流式推理
curl -X POST http://localhost:8080/api/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-model",
    "version": "v1",
    "input": "Hello, world!"
  }' \
  --no-buffer
```

### 2. 热更新测试
```bash
# 在另一个终端启动长时间运行的推理请求
curl -X POST http://localhost:8080/api/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-model",
    "version": "v1",
    "input": "This is a long request that will take time to complete..."
  }' \
  --no-buffer &

# 在主终端更新模型
curl -X PUT http://localhost:8080/api/v1/models/test-model/version/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "backend_type": "mock"
    }
  }'

# 验证新请求使用新版本
curl -X POST http://localhost:8080/api/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-model",
    "version": "v1",
    "input": "New request after update"
  }' \
  --no-buffer
```

## 🔍 设计亮点

### 1. 热更新机制
- **版本隔离**: 新版本不影响现有连接
- **引用计数**: 使用atomic操作跟踪活跃连接
- **延迟清理**: 只有无活跃连接时才清理资源

### 2. 流式响应
- **SSE协议**: 比WebSocket更适合单向数据推送
- **超时控制**: 60秒超时，避免长时间阻塞
- **错误处理**: 优雅处理连接断开和错误

### 3. 并发安全
- **读写锁**: 读多写少的场景优化
- **原子操作**: 活跃连接计数无锁更新
- **深拷贝**: 避免并发访问问题

## 📊 Self Report

- **总耗时**: 2 小时
- **实际做题时间段**: 14:00 ~ 16:00
- **完成情况**:
  - [x] 模型注册 / 更新 / 查看
  - [x] 流式推理接口
  - [x] 热更新不影响已有连接
  - [x] 多后端支持 (OpenAI + Gemini + Mock)
  - [ ] 多版本分流
  - [ ] Prometheus metrics
  - [ ] 灰度发布
- **备注说明**:
  - 实现了完整的MVP功能，满足验收标准
  - 热更新机制使用版本隔离和引用计数，确保现有连接不受影响
  - 使用SSE协议实现流式响应，比WebSocket更适合此场景
  - 支持OpenAI和Gemini真实API，以及Mock后端用于测试
  - 下一步可优化：添加Prometheus监控、实现多版本分流、支持更多后端类型

## 🤝 贡献

欢迎提交Issue和Pull Request！

## �� 许可证

MIT License
