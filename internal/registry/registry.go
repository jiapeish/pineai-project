package registry

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"pineai-project/internal/model"
)

// ModelRegistry 模型注册表
type ModelRegistry struct {
	models         map[string]map[string]*model.ModelInstance // name -> version -> instance
	processManager *model.ProcessManager
	mu             sync.RWMutex
}

// NewModelRegistry 创建新的模型注册表
func NewModelRegistry() *ModelRegistry {
	return &ModelRegistry{
		models:         make(map[string]map[string]*model.ModelInstance),
		processManager: model.NewProcessManager(8081), // 从8081开始分配端口
	}
}

// RegisterModel 注册模型
// 设计意图：支持动态模型注册，新注册的模型立即可用于推理
func (r *ModelRegistry) RegisterModel(ctx context.Context, req *model.ModelRegistrationRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	log.Printf("[REGISTRY] RegisterModel called: name=%s, version=%s, backend=%s", req.Name, req.Version, req.BackendType)

	// 创建新模型实例
	instance := &model.ModelInstance{
		Name:        req.Name,
		Version:     req.Version,
		BackendType: req.BackendType,
		Status:      model.StatusLoading,
		Config:      req.Config,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	log.Printf("[REGISTRY] Initializing model instance: %+v", instance)
	// 初始化模型
	if err := instance.Initialize(); err != nil {
		log.Printf("[REGISTRY][ERROR] Model instance initialize failed: %v", err)
		return err
	}

	log.Printf("[REGISTRY] Starting model process for: %s-%s", req.Name, req.Version)
	// 启动模型进程
	if err := r.processManager.StartModelProcess(ctx, instance); err != nil {
		log.Printf("[REGISTRY][ERROR] StartModelProcess failed: %v", err)
		return err
	}

	// 注册模型
	if r.models[req.Name] == nil {
		r.models[req.Name] = make(map[string]*model.ModelInstance)
	}

	// 如果版本已存在，标记为deprecated
	if existing, exists := r.models[req.Name][req.Version]; exists {
		existing.Status = model.StatusDeprecated
	}

	r.models[req.Name][req.Version] = instance
	instance.Status = model.StatusReady

	log.Printf("[REGISTRY] Model registered successfully: %s-%s", req.Name, req.Version)
	return nil
}

// GetModel 获取模型实例
// 设计意图：只返回ready状态的模型，并增加活跃连接计数
func (r *ModelRegistry) GetModel(name, version string) (*model.ModelInstance, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if versions, exists := r.models[name]; exists {
		if instance, exists := versions[version]; exists {
			// 只返回ready状态的实例
			if instance.Status == model.StatusReady {
				atomic.AddInt32(&instance.ActiveConnections, 1)
				return instance, nil
			}
		}
	}
	return nil, model.ErrModelNotFound
}

// GetModelProcess 获取模型进程信息
func (r *ModelRegistry) GetModelProcess(name, version string) (*model.ModelProcess, bool) {
	modelID := name + "-" + version
	return r.processManager.GetModelProcess(modelID)
}

// GetModelProcessForInference 获取用于推理的模型进程
func (r *ModelRegistry) GetModelProcessForInference(name, version string) (*model.ModelProcess, bool) {
	modelID := name + "-" + version
	return r.processManager.GetModelProcessForInference(modelID)
}

// ReleaseModelProcess 释放模型进程连接
func (r *ModelRegistry) ReleaseModelProcess(name, version string) {
	modelID := name + "-" + version
	r.processManager.ReleaseModelProcess(modelID)
}

// ReleaseModel 释放模型连接
// 设计意图：减少活跃连接计数，用于连接结束时调用
func (r *ModelRegistry) ReleaseModel(name, version string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if versions, exists := r.models[name]; exists {
		if instance, exists := versions[version]; exists {
			atomic.AddInt32(&instance.ActiveConnections, -1)
		}
	}
}

// UpdateModel 热更新模型（支持版本号变更）
// 设计意图：实现热更新机制，创建新版本实例，旧版本继续服务现有连接
func (r *ModelRegistry) UpdateModel(ctx context.Context, name, oldVersion, newVersion string, config model.ModelConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 检查原模型是否存在
	if versions, exists := r.models[name]; !exists {
		return model.ErrModelNotFound
	} else if _, exists := versions[oldVersion]; !exists {
		return model.ErrModelNotFound
	}

	// 检查新版本是否已存在
	if versions, exists := r.models[name]; exists {
		if _, exists := versions[newVersion]; exists {
			return fmt.Errorf("model version %s already exists", newVersion)
		}
	}

	// 创建新版本实例（状态为loading）
	newInstance := &model.ModelInstance{
		Name:        name,
		Version:     newVersion, // 使用新版本号
		BackendType: config.BackendType,
		Status:      model.StatusLoading,
		Config:      config,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 初始化新版本
	if err := newInstance.Initialize(); err != nil {
		return err
	}

	// 启动新版本模型进程
	if err := r.processManager.StartModelProcess(ctx, newInstance); err != nil {
		return err
	}

	// 注册新版本
	if r.models[name] == nil {
		r.models[name] = make(map[string]*model.ModelInstance)
	}
	r.models[name][newVersion] = newInstance
	newInstance.Status = model.StatusReady

	// 标记旧版本为废弃（不再接收新请求，但继续服务现有连接）
	oldInstance := r.models[name][oldVersion]
	oldInstance.Status = model.StatusDeprecated

	log.Printf("[REGISTRY] Model updated: %s from v%s to v%s", name, oldVersion, newVersion)
	log.Printf("[REGISTRY] Old version %s marked as deprecated, new requests will use v%s", oldVersion, newVersion)

	return nil
}

// ListModels 列出所有模型
func (r *ModelRegistry) ListModels() *model.ModelListResponse {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// 深拷贝模型列表，避免并发访问问题
	modelsCopy := make(map[string]map[string]*model.ModelInstance)
	for name, versions := range r.models {
		modelsCopy[name] = make(map[string]*model.ModelInstance)
		for version, instance := range versions {
			// 创建实例副本，避免并发修改
			instanceCopy := *instance
			modelsCopy[name][version] = &instanceCopy
		}
	}

	return &model.ModelListResponse{
		Models: modelsCopy,
	}
}

// ListProcesses 列出所有模型进程
func (r *ModelRegistry) ListProcesses() []*model.ModelProcess {
	return r.processManager.ListProcesses()
}

// DeleteModel 删除模型
func (r *ModelRegistry) DeleteModel(name, version string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if versions, exists := r.models[name]; exists {
		if instance, exists := versions[version]; exists {
			// 检查是否有活跃连接
			if instance.ActiveConnections > 0 {
				// 有活跃连接时，标记为deprecated而不是直接删除
				instance.Status = model.StatusDeprecated
				return nil
			}

			// 停止模型进程
			modelID := name + "-" + version
			if err := r.processManager.StopModelProcess(modelID); err != nil {
				// 记录错误但不阻止删除
				// log.Printf("Failed to stop model process %s: %v", modelID, err)
			}

			// 无活跃连接时，直接删除
			delete(versions, version)
			// 如果该模型的所有版本都被删除，删除整个模型
			if len(versions) == 0 {
				delete(r.models, name)
			}
			return nil
		}
	}
	return model.ErrModelNotFound
}

// CleanupDeprecatedModels 清理废弃的模型
// 设计意图：定期清理无活跃连接的deprecated模型，避免内存泄漏
func (r *ModelRegistry) CleanupDeprecatedModels() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for name, versions := range r.models {
		for version, instance := range versions {
			// 清理条件：deprecated状态 + 无活跃连接 + 超过清理时间
			if instance.Status == model.StatusDeprecated &&
				instance.ActiveConnections == 0 &&
				time.Since(instance.UpdatedAt) > 5*time.Minute {

				// 停止模型进程
				modelID := name + "-" + version
				if err := r.processManager.StopModelProcess(modelID); err != nil {
					// log.Printf("Failed to stop deprecated model process %s: %v", modelID, err)
				}

				delete(versions, version)
			}
		}
		// 如果某个模型的所有版本都被清理，删除整个模型
		if len(versions) == 0 {
			delete(r.models, name)
		}
	}
}

// StartCleanupRoutine 启动清理协程
func (r *ModelRegistry) StartCleanupRoutine() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			r.CleanupDeprecatedModels()
		}
	}()
}

// GetProcessStats 获取进程统计信息
func (r *ModelRegistry) GetProcessStats() map[string]interface{} {
	return r.processManager.GetProcessStats()
}
