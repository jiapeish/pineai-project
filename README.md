# PineAI - 多模型托管与推理服务平台

基于Golang和React构建的现代化AI模型管理平台，支持动态模型注册与更新，并对接第三方LLM实现流式响应。

## 🎯 项目特色

- **前后端分离**: Golang后端 + React前端
- **现代化UI**: 基于Ant Design的响应式界面
- **实时监控**: 流式推理和性能指标可视化
- **并发测试**: 多标签页并发测试和热更新验证

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
- **热更新**: 进程隔离 + 版本化模型实例
- **进程管理**: 独立Golang进程 + HTTP通信

### 核心设计理念
- **进程隔离**: 每个模型运行在独立进程中，确保稳定性
- **热更新**: 新进程启动后，旧进程继续服务现有连接
- **资源管理**: 自动端口分配和进程生命周期管理

### 项目结构
```
pineai-project/
├── cmd/server/          # 后端主程序入口
├── internal/            # 后端内部包
│   ├── handler/         # HTTP处理器
│   ├── model/           # 模型定义和进程管理
│   ├── registry/        # 模型注册表
│   ├── streamer/        # 流式推理器
│   ├── metrics/         # Prometheus指标
│   └── dashboard/       # 管理面板
├── cmd/                 # 可执行程序
│   ├── server/          # 主服务进程
│   └── model/           # 模型服务进程
├── web/                 # 前端应用
│   ├── frontend/        # React前端
│   ├── templates/       # HTML模板
│   └── static/          # 静态资源
├── pkg/                 # 公共包
├── config/              # 配置文件
├── test/                # 测试脚本
├── go.mod              # 依赖管理
└── README.md           # 项目文档
```

## 🚀 快速开始

### 1. 启动后端服务

#### 安装Go依赖
```bash
go mod tidy
```



#### 配置API密钥
在 `config/config.yaml` 中配置真实的API密钥：
```yaml
api_keys:
  openai:
    key: "your-openai-api-key"
  gemini:
    key: "your-gemini-api-key"
```

#### 构建服务
```bash
# 构建主服务和模型进程
./build.sh
```

#### 启动后端
```bash
# 使用构建的可执行文件
./build/pineai-server

# 或者直接运行
go run cmd/server/main.go
```

后端服务将在 `http://localhost:8080` 启动

#### 健康检查
```bash
curl http://localhost:8080/api/v1/health
```

### 2. 启动前端应用

#### 安装Node.js依赖
```bash
cd web/frontend
npm install
```

#### 启动前端开发服务器
```bash
npm start
# 或者使用启动脚本
./start.sh
```

前端应用将在 `http://localhost:3000` 启动，自动代理到后端API

### 3. 访问应用

- **前端界面**: http://localhost:3000
- **后端API**: http://localhost:8080
- **管理面板**: http://localhost:8080/dashboard
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

### 6. 查看模型进程
```bash
curl http://localhost:8080/api/v1/processes
```

### 7. 查看进程统计
```bash
curl http://localhost:8080/api/v1/stats
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

### 2. Golang进程架构测试
```bash
# 运行完整的Golang进程架构测试
./test/golang_process_test.sh
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

## 🎨 前端功能

### 核心页面
- **仪表盘**: 实时系统概览和关键指标
- **模型管理**: 动态注册、编辑、删除模型
- **推理测试**: 流式推理测试和实时输出显示
- **并发测试**: 多标签页并发测试和热更新验证
- **性能指标**: 详细的性能监控和图表分析
- **系统设置**: 配置管理和帮助文档

### 技术特性
- **响应式设计**: 支持桌面和移动设备
- **实时更新**: 自动刷新数据和状态
- **流式输出**: 支持SSE流式推理显示
- **动画效果**: 流畅的页面过渡和交互动画
- **主题定制**: 基于Ant Design的设计系统

### 技术栈
- **React 18**: 现代化的React框架
- **Ant Design 5**: 企业级UI组件库
- **React Query**: 数据获取和缓存管理
- **React Router**: 客户端路由
- **Recharts**: 数据可视化图表
- **Framer Motion**: 动画库

## 📊 Self Report

- **总耗时**: 4 小时
- **实际做题时间段**: 14:00 ~ 18:00
- **完成情况**:
  - [x] 模型注册 / 更新 / 查看
  - [x] 流式推理接口
  - [x] 热更新不影响已有连接
  - [x] 独立模型进程管理
  - [x] 进程隔离和资源管理
  - [x] 多后端支持 (OpenAI + Gemini + Mock)
  - [x] Prometheus metrics
  - [x] 简易管理面板
  - [x] React前端界面
  - [x] 并发测试功能
  - [ ] 多版本分流
  - [ ] 灰度发布
- **备注说明**:
  - 实现了真正的模型进程隔离架构，每个模型运行在独立Golang进程中
  - 支持热更新：新进程启动后，新请求路由到新进程，旧进程继续服务现有连接
  - 自动端口分配和进程生命周期管理
  - 使用SSE协议实现流式响应，比WebSocket更适合此场景
  - 支持OpenAI和Gemini真实API，以及Mock后端用于测试
  - 下一步可优化：支持更多后端类型，实现负载均衡和故障转移

## 🤝 贡献

欢迎提交Issue和Pull Request！

## �� 许可证

MIT License
