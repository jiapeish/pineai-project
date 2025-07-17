# PineAI 前端管理界面

这是 PineAI 多模型托管与推理平台的前端管理界面，基于 React + Ant Design 构建。

## 功能特性

### 🎯 核心功能
- **模型管理**: 动态注册、编辑、删除模型
- **热更新**: 支持模型版本热更新，零停机升级
- **进程管理**: 实时监控和管理模型进程
- **推理测试**: 内置推理测试工具
- **性能监控**: 实时性能指标和连接状态
- **并发测试**: 支持多并发连接测试

### 🚀 技术特性
- **实时更新**: 自动刷新数据和状态
- **流式推理**: 支持 Server-Sent Events 流式响应
- **响应式设计**: 适配各种屏幕尺寸
- **现代化UI**: 基于 Ant Design 5.x 的现代化界面

## 快速开始

### 1. 安装依赖
```bash
cd web/frontend
npm install
```

### 2. 启动开发服务器
```bash
npm start
```

前端将在 http://localhost:3000 启动，并自动代理到后端 API (http://localhost:8080)。

### 3. 构建生产版本
```bash
npm run build
```

## 使用指南

### 仪表盘
- **系统概览**: 显示总模型数、就绪模型、活跃连接等关键指标
- **模型列表**: 快速查看所有模型状态和基本信息
- **进程状态**: 实时监控模型进程的运行状态
- **性能指标**: 查看请求统计和响应时间

### 模型管理
1. **注册模型**
   - 点击"注册模型"按钮
   - 填写模型名称、版本、后端类型等信息
   - 对于 OpenAI/Gemini 模型，需要提供 API 密钥
   - 支持自定义基础 URL

2. **热更新**
   - 点击模型列表中的"热更新"按钮
   - 输入新版本号和相关配置
   - 系统会自动启动新版本进程
   - 旧版本进程在新版本就绪后自动停止

3. **进程管理**
   - 启动/停止模型进程
   - 查看进程状态和端口信息
   - 监控进程运行时间

### 推理测试
- 选择模型和版本
- 输入测试文本
- 支持流式和非流式推理
- 实时显示推理结果

### 并发测试
- 模拟多用户并发访问
- 测试系统性能和稳定性
- 监控连接数和响应时间

## API 接口

前端通过以下 API 与后端通信：

### 模型管理
- `GET /api/v1/models` - 获取模型列表
- `POST /api/v1/models` - 注册新模型
- `PUT /api/v1/models/{name}/version/{version}` - 更新模型（热更新）
- `DELETE /api/v1/models/{name}/version/{version}` - 删除模型

### 推理接口
- `POST /api/v1/infer` - 普通推理
- `GET /api/v1/infer` - 流式推理（SSE）

### 进程管理
- `GET /api/v1/processes` - 获取进程列表
- `POST /api/v1/processes/{name}/version/{version}/start` - 启动进程
- `POST /api/v1/processes/{name}/version/{version}/stop` - 停止进程
- `POST /api/v1/processes/{name}/version/{version}/restart` - 重启进程

### 系统监控
- `GET /api/v1/dashboard` - 获取仪表盘数据
- `GET /api/v1/metrics` - 获取性能指标

## 配置说明

### 环境变量
- `REACT_APP_API_URL`: 后端 API 地址（默认: http://localhost:8080/api/v1）

### 代理配置
前端开发时自动代理到后端，生产环境需要配置反向代理。

## 开发指南

### 项目结构
```
src/
├── components/     # 通用组件
├── pages/         # 页面组件
│   ├── Dashboard.js           # 仪表盘
│   ├── ModelManagement.js     # 模型管理
│   ├── Inference.js           # 推理测试
│   ├── ConcurrencyTest.js     # 并发测试
│   ├── Metrics.js             # 性能指标
│   └── Settings.js            # 系统设置
├── services/      # API 服务
│   └── api.js     # API 接口定义
├── utils/         # 工具函数
├── App.js         # 主应用组件
└── index.js       # 应用入口
```

### 添加新功能
1. 在 `services/api.js` 中添加新的 API 接口
2. 在 `pages/` 目录下创建新的页面组件
3. 在 `App.js` 中添加路由配置
4. 更新侧边栏菜单

### 样式定制
- 使用 Ant Design 主题定制
- 支持 CSS-in-JS 和 CSS Modules
- 响应式设计适配

## 故障排除

### 常见问题

1. **前端无法连接后端**
   - 检查后端服务是否启动
   - 确认端口 8080 是否可访问
   - 检查 CORS 配置

2. **热更新失败**
   - 确认新版本号格式正确
   - 检查 API 密钥是否有效
   - 查看后端日志获取详细错误信息

3. **进程启动失败**
   - 检查端口是否被占用
   - 确认模型配置是否正确
   - 查看进程日志

### 调试技巧
- 使用浏览器开发者工具查看网络请求
- 检查控制台错误信息
- 查看后端服务日志

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本的模型管理功能
- 实现热更新机制
- 添加进程管理功能
- 集成推理测试工具

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目。

## 许可证

本项目采用 MIT 许可证。 