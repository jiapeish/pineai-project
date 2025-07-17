# PineAI 模型版本热更新 API

## 概述

PineAI 支持模型版本热更新功能，允许在不中断服务的情况下更新模型配置和版本号。热更新会创建新的模型版本，同时保持旧版本继续服务现有连接。

## API 接口

### PUT /api/v1/models/{name}/version/{version}

更新模型到新版本，支持版本号变更。

#### 请求参数

- `name` (path): 模型名称
- `version` (path): 当前版本号

#### 请求体

```json
{
  "new_version": "v2.0.0",  // 新版本号（必需）
  "config": {               // 新配置（必需）
    "backend_type": "openai",
    "model_name": "gpt-4",
    "max_tokens": 2000,
    "temperature": 0.8
  }
}
```

#### 响应

```json
{
  "message": "model updated successfully",
  "model": {
    "name": "gpt-4",
    "old_version": "v1.0.0",
    "new_version": "v2.0.0",
    "status": "ready",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

## 热更新机制

### 1. 版本管理

- **旧版本**: 标记为 `deprecated`，继续服务现有连接
- **新版本**: 创建新的模型实例和进程，接收新请求
- **版本共存**: 新旧版本可以同时存在，直到旧版本连接完成

### 2. 进程管理

- 每个版本运行在独立的进程中
- 新版本使用新的端口
- 旧版本进程在无活跃连接后自动清理

### 3. 请求路由

- 新请求自动路由到最新版本
- 现有连接继续使用旧版本
- 零停机时间更新

## 使用示例

### 1. 注册初始模型

```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpt-4",
    "version": "v1.0.0",
    "backend_type": "openai",
    "config": {
      "model_name": "gpt-4",
      "max_tokens": 1000,
      "temperature": 0.7
    }
  }'
```

### 2. 热更新到新版本

```bash
curl -X PUT http://localhost:8080/api/v1/models/gpt-4/version/v1.0.0 \
  -H "Content-Type: application/json" \
  -d '{
    "new_version": "v2.0.0",
    "config": {
      "backend_type": "openai",
      "model_name": "gpt-4",
      "max_tokens": 2000,
      "temperature": 0.8
    }
  }'
```

### 3. 查看模型列表

```bash
curl http://localhost:8080/api/v1/models
```

响应示例：
```json
{
  "models": {
    "gpt-4": {
      "v1.0.0": {
        "name": "gpt-4",
        "version": "v1.0.0",
        "status": "deprecated",
        "active_connections": 0
      },
      "v2.0.0": {
        "name": "gpt-4",
        "version": "v2.0.0",
        "status": "ready",
        "active_connections": 0
      }
    }
  }
}
```

### 4. 测试推理

```bash
# 使用新版本推理
curl -X POST http://localhost:8080/api/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "version": "v2.0.0",
    "input": "Hello from new version"
  }'
```

## 错误处理

### 常见错误

1. **版本已存在**
```json
{
  "error": "model version v2.0.0 already exists"
}
```

2. **版本号相同**
```json
{
  "error": "new_version must be different from current version"
}
```

3. **模型不存在**
```json
{
  "error": "model not found"
}
```

## 最佳实践

### 1. 版本命名

- 使用语义化版本号（如 `v1.0.0`, `v1.1.0`）
- 避免使用特殊字符
- 保持版本号的一致性

### 2. 配置管理

- 在更新前备份当前配置
- 逐步更新配置参数
- 测试新配置的有效性

### 3. 监控和清理

- 监控新旧版本的连接数
- 定期清理废弃的版本
- 查看进程状态和健康检查

### 4. 回滚策略

- 保留旧版本作为回滚选项
- 监控新版本的性能指标
- 准备快速回滚机制

## 测试脚本

项目提供了测试脚本来验证热更新功能：

```bash
# 完整测试
./test/hot_update_test.sh

# 简单测试
./test/simple_hot_update_test.sh
```

## 注意事项

1. **API 密钥**: 确保新配置中的 API 密钥有效
2. **端口冲突**: 系统会自动分配可用端口
3. **资源使用**: 新旧版本同时运行会增加资源消耗
4. **连接超时**: 长时间运行的推理请求可能受到影响
5. **清理时机**: 废弃版本会在无活跃连接后自动清理

## 技术实现

### 核心组件

1. **ModelRegistry**: 管理模型版本和状态
2. **ProcessManager**: 管理模型进程生命周期
3. **Handler**: 处理 HTTP 请求和响应

### 关键特性

- **原子性更新**: 确保更新过程的原子性
- **连接跟踪**: 实时跟踪活跃连接数
- **进程隔离**: 每个版本运行在独立进程中
- **健康检查**: 自动监控进程健康状态
- **优雅关闭**: 支持进程的优雅关闭

这个热更新机制确保了服务的高可用性和零停机时间更新。 