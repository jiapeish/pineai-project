# PineAI 前端应用

基于React和Ant Design构建的现代化AI模型管理平台前端界面。

## 功能特性

### 🎯 核心功能
- **仪表盘**: 实时系统概览和关键指标展示
- **模型管理**: 动态注册、编辑、删除模型
- **推理测试**: 流式推理测试和实时输出显示
- **并发测试**: 多标签页并发测试和热更新验证
- **性能指标**: 详细的性能监控和图表分析
- **系统设置**: 配置管理和帮助文档

### 🚀 技术特性
- **响应式设计**: 支持桌面和移动设备
- **实时更新**: 自动刷新数据和状态
- **流式输出**: 支持SSE流式推理显示
- **动画效果**: 流畅的页面过渡和交互动画
- **主题定制**: 基于Ant Design的设计系统

## 技术栈

- **React 18**: 现代化的React框架
- **Ant Design 5**: 企业级UI组件库
- **React Query**: 数据获取和缓存管理
- **React Router**: 客户端路由
- **Recharts**: 数据可视化图表
- **Framer Motion**: 动画库
- **Axios**: HTTP客户端

## 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
cd web/frontend
npm install
```

### 启动开发服务器
```bash
npm start
```

应用将在 http://localhost:3000 启动，并自动代理到后端API (http://localhost:8080)。

### 构建生产版本
```bash
npm run build
```

构建文件将生成在 `build` 目录中。

## 项目结构

```
src/
├── components/          # 可复用组件
├── pages/              # 页面组件
│   ├── Dashboard.js    # 仪表盘
│   ├── ModelManagement.js  # 模型管理
│   ├── Inference.js    # 推理测试
│   ├── ConcurrencyTest.js  # 并发测试
│   ├── Metrics.js      # 性能指标
│   └── Settings.js     # 系统设置
├── services/           # API服务
│   └── api.js         # API接口封装
├── utils/              # 工具函数
├── App.js             # 主应用组件
├── index.js           # 应用入口
└── index.css          # 全局样式
```

## 页面说明

### 仪表盘 (Dashboard)
- 系统概览和关键指标
- 模型列表和状态
- 实时数据更新

### 模型管理 (Model Management)
- 模型注册和配置
- 支持多种后端类型
- 实时状态监控

### 推理测试 (Inference)
- 流式推理测试
- 实时输出显示
- 支持复制和下载结果

### 并发测试 (Concurrency Test)
- 多标签页并发测试
- 热更新验证
- 性能统计和分析

### 性能指标 (Metrics)
- 详细的性能图表
- 历史数据趋势
- 模型性能对比

### 系统设置 (Settings)
- 系统配置管理
- API文档
- 帮助和故障排除

## API接口

前端通过以下接口与后端通信：

- `GET /api/v1/models` - 获取模型列表
- `POST /api/v1/models` - 注册模型
- `PUT /api/v1/models/{name}/version/{version}` - 更新模型
- `DELETE /api/v1/models/{name}/version/{version}` - 删除模型
- `POST /api/v1/infer` - 执行推理
- `GET /api/v1/dashboard` - 获取仪表盘数据
- `GET /api/v1/metrics` - 获取性能指标

## 开发指南

### 添加新页面
1. 在 `src/pages/` 目录创建新页面组件
2. 在 `src/App.js` 中添加路由
3. 在侧边栏菜单中添加导航项

### 添加新API接口
1. 在 `src/services/api.js` 中添加接口函数
2. 在页面组件中使用 `useQuery` 或 `useMutation`

### 样式定制
- 全局样式在 `src/index.css`
- 组件样式使用Ant Design的样式系统
- 动画使用Framer Motion

## 部署

### 开发环境
```bash
npm start
```

### 生产环境
```bash
npm run build
```

构建后的文件可以部署到任何静态文件服务器。

### Docker部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 故障排除

### 常见问题

1. **API连接失败**
   - 检查后端服务是否运行
   - 确认API地址配置正确

2. **流式输出中断**
   - 检查浏览器EventSource支持
   - 确认网络连接稳定

3. **页面加载缓慢**
   - 检查网络连接
   - 确认后端响应时间

### 调试技巧

- 使用浏览器开发者工具查看网络请求
- 检查控制台错误信息
- 使用React Developer Tools调试组件

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License 