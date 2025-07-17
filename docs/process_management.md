# PineAI 进程管理机制详解

## 概述

PineAI 采用多进程架构，每个模型运行在独立的 Golang 进程中，通过 HTTP API 进行通信。本文档详细说明进程管理、热更新和连接跟踪机制。

## 架构设计

### 1. 进程类型

- **主服务进程** (`cmd/server/main.go`): 负责模型注册、路由和请求分发
- **模型进程** (`cmd/model/main.go`): 每个模型一个独立进程，处理推理请求

### 2. 进程状态

```go
type ModelProcess struct {
    ID                 string            // 进程ID: {model_name}-{version}
    Name               string            // 模型名称
    Version            string            // 模型版本
    BackendType        string            // 后端类型: openai/gemini/mock
    Port               int               // 监听端口
    Status             string            // 状态: running/stopping/stopped/error
    ActiveConnections  int32             // 活跃连接数（原子计数器）
    IsDeprecated       bool              // 是否已废弃（不再接收新请求）
    // ... 其他字段
}
```

## 进程生命周期管理

### 1. 进程启动

```go
// 注册模型时自动启动进程
func (pm *ProcessManager) StartModelProcess(ctx context.Context, model *ModelInstance) error {
    // 1. 分配端口
    port := pm.allocatePort()
    
    // 2. 创建进程实例
    process := &ModelProcess{
        // ... 初始化字段
        ActiveConnections: 0,
        IsDeprecated: false,
    }
    
    // 3. 启动进程
    cmd := exec.CommandContext(ctx, modelExecutable)
    // ... 设置环境变量
    
    // 4. 注册到进程管理器
    pm.processes[modelID] = process
    
    // 5. 启动健康监控
    go pm.monitorProcessHealth(ctx, process)
}
```

### 2. 进程路由

```go
// 获取用于推理的进程（自动增加连接计数）
func (pm *ProcessManager) GetModelProcessForInference(modelID string) (*ModelProcess, bool) {
    process, exists := pm.processes[modelID]
    if !exists || process.IsDeprecated {
        return nil, false
    }
    
    // 原子操作增加活跃连接计数
    atomic.AddInt32(&process.ActiveConnections, 1)
    return process, true
}
```

### 3. 连接释放

```go
// 推理完成后释放连接
func (pm *ProcessManager) ReleaseModelProcess(modelID string) {
    process, exists := pm.processes[modelID]
    if !exists {
        return
    }
    
    // 原子操作减少活跃连接计数
    atomic.AddInt32(&process.ActiveConnections, -1)
    
    // 如果进程已废弃且无活跃连接，启动清理
    if process.IsDeprecated && atomic.LoadInt32(&process.ActiveConnections) == 0 {
        go pm.cleanupDeprecatedProcess(process)
    }
}
```

## 热更新机制

### 1. 更新流程

```go
func (pm *ProcessManager) UpdateModelProcess(ctx context.Context, model *ModelInstance) error {
    modelID := fmt.Sprintf("%s-%s", model.Name, model.Version)
    
    // 1. 获取旧进程
    oldProcess, exists := pm.GetModelProcess(modelID)
    if !exists {
        return fmt.Errorf("model process %s not found", modelID)
    }
    
    // 2. 启动新进程
    newProcess := &ModelProcess{
        // ... 新进程配置
        Port: pm.allocatePort(), // 新端口
        ActiveConnections: 0,
        IsDeprecated: false,
    }
    
    // 3. 启动新进程并等待就绪
    pm.startProcess(ctx, newProcess)
    pm.waitForProcessReady(newProcess)
    
    // 4. 标记旧进程为废弃，更新路由
    pm.mu.Lock()
    oldProcess.IsDeprecated = true
    pm.processes[modelID] = newProcess // 新请求路由到新进程
    pm.mu.Unlock()
    
    // 5. 检查旧进程是否可以清理
    if atomic.LoadInt32(&oldProcess.ActiveConnections) == 0 {
        go pm.cleanupDeprecatedProcess(oldProcess)
    }
    
    return nil
}
```

### 2. 废弃进程清理

```go
func (pm *ProcessManager) cleanupDeprecatedProcess(process *ModelProcess) {
    log.Printf("Cleaning up deprecated process: %s on port %d", process.ID, process.Port)
    
    // 等待所有活跃连接完成
    for atomic.LoadInt32(&process.ActiveConnections) > 0 {
        log.Printf("Waiting for %d active connections to complete on process %s", 
            atomic.LoadInt32(&process.ActiveConnections), process.ID)
        time.Sleep(1 * time.Second)
    }
    
    // 停止进程
    pm.StopModelProcess(process.ID)
}
```

## 并发控制

### 1. 原子操作

- 使用 `sync/atomic` 包进行活跃连接计数
- 确保并发安全，无锁操作

### 2. 读写锁

- 使用 `sync.RWMutex` 保护进程映射
- 读多写少的场景优化

### 3. 进程隔离

- 每个模型独立进程，互不影响
- 进程崩溃不影响其他模型

## 请求流程

### 1. 推理请求处理

```go
func (h *Handler) StreamInference(c *gin.Context) {
    // 1. 获取模型实例
    modelInstance, err := h.registry.GetModel(req.Model, req.Version)
    
    // 2. 获取模型进程（自动增加连接计数）
    modelProcess, exists := h.registry.GetModelProcessForInference(req.Model, req.Version)
    
    // 3. 转发请求到模型进程
    err = h.forwardToModelProcess(c, modelProcess, req)
    
    // 4. 确保连接结束时释放资源
    defer func() {
        h.registry.ReleaseModel(req.Model, req.Version)
        h.registry.ReleaseModelProcess(req.Model, req.Version)
    }()
}
```

### 2. 连接跟踪

- 每个推理请求都会增加进程的活跃连接计数
- 请求完成后自动减少计数
- 废弃进程只有在所有连接完成后才会被清理

## 监控和统计

### 1. 进程状态监控

```go
func (pm *ProcessManager) GetProcessStats() map[string]interface{} {
    stats := map[string]interface{}{
        "total_processes": len(pm.processes),
        "running":         0,
        "stopping":        0,
        "stopped":         0,
        "error":           0,
        "total_connections": 0,
    }
    
    for _, process := range pm.processes {
        connections := atomic.LoadInt32(&process.ActiveConnections)
        stats["total_connections"] = stats["total_connections"].(int) + int(connections)
        // ... 统计各状态进程数量
    }
    
    return stats
}
```

### 2. 健康检查

- 定期检查进程健康状态
- 自动检测进程崩溃
- 支持进程重启机制

## API 接口

### 1. 进程管理

- `GET /api/v1/processes` - 列出所有进程
- `GET /api/v1/stats` - 获取进程统计信息

### 2. 模型管理

- `POST /api/v1/models` - 注册模型（自动启动进程）
- `PUT /api/v1/models/{name}/version/{version}` - 热更新模型
- `DELETE /api/v1/models/{name}/version/{version}` - 删除模型

## 优势

### 1. 真正的热更新

- 新请求立即路由到新进程
- 旧进程继续服务现有连接
- 无服务中断

### 2. 资源管理

- 自动端口分配
- 连接计数跟踪
- 智能进程清理

### 3. 并发支持

- 每个进程支持多个并发请求
- 原子操作保证线程安全
- 进程隔离确保稳定性

### 4. 监控完善

- 实时连接统计
- 进程状态监控
- 健康检查机制

## 使用示例

### 1. 注册模型

```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gpt-4",
    "version": "v1",
    "backend_type": "openai",
    "config": {
      "model_name": "gpt-4",
      "max_tokens": 1000
    }
  }'
```

### 2. 热更新模型

```bash
# 启动长时间运行的请求
curl -X POST http://localhost:8080/api/v1/infer \
  -d '{"model": "gpt-4", "version": "v1", "input": "Long request..."}' &

# 更新模型（新请求路由到新进程）
curl -X PUT http://localhost:8080/api/v1/models/gpt-4/version/v1 \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "model_name": "gpt-4",
      "max_tokens": 2000
    }
  }'

# 旧请求继续执行，新请求使用新配置
```

### 3. 查看进程状态

```bash
# 查看所有进程
curl http://localhost:8080/api/v1/processes

# 查看统计信息
curl http://localhost:8080/api/v1/stats
```

这个进程管理机制确保了：

1. **零停机热更新**：新进程启动后，新请求立即路由到新进程
2. **连接保护**：旧进程继续服务现有连接，直到所有推理完成
3. **资源清理**：只有在所有连接完成后才清理废弃进程
4. **并发安全**：使用原子操作和读写锁保证线程安全
5. **监控完善**：实时跟踪进程状态和连接数量 