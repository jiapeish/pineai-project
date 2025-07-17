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
		LastUsedAt:  time.Now(),
		IdleTimeout: 1 * time.Minute, // 默认30分钟空闲超时
		IsLoaded:    false,
	}

	log.Printf("[REGISTRY] Initializing model instance: %+v", instance)
	// 初始化模型
	if err := instance.Initialize(); err != nil {
		log.Printf("[REGISTRY][ERROR] Model instance initialize failed: %v", err)
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

	// 首次注册时立即启动进程
	log.Printf("[REGISTRY] Starting model process for: %s-%s (first registration)", req.Name, req.Version)
	if err := r.loadModel(ctx, instance); err != nil {
		log.Printf("[REGISTRY][ERROR] StartModelProcess failed: %v", err)
		instance.Status = model.StatusUnloaded
	} else {
		instance.Status = model.StatusReady
		instance.IsLoaded = true
	}

	log.Printf("[REGISTRY] Model registered successfully: %s-%s", req.Name, req.Version)
	return nil
}

// loadModel 加载模型（启动进程）
func (r *ModelRegistry) loadModel(ctx context.Context, instance *model.ModelInstance) error {
	log.Printf("[REGISTRY] Loading model: %s-%s", instance.Name, instance.Version)

	// 启动模型进程
	if err := r.processManager.StartModelProcess(ctx, instance); err != nil {
		log.Printf("[REGISTRY][ERROR] Failed to start model process: %v", err)
		return err
	}

	instance.IsLoaded = true
	instance.Status = model.StatusReady
	instance.LastUsedAt = time.Now()

	log.Printf("[REGISTRY] Model loaded successfully: %s-%s", instance.Name, instance.Version)
	return nil
}

// unloadModel 卸载模型（停止进程）
func (r *ModelRegistry) unloadModel(instance *model.ModelInstance) error {
	log.Printf("[REGISTRY] Unloading model: %s-%s", instance.Name, instance.Version)

	// 停止模型进程
	modelID := instance.Name + "-" + instance.Version
	if err := r.processManager.StopModelProcess(modelID); err != nil {
		log.Printf("[REGISTRY][ERROR] Failed to stop model process: %v", err)
		return err
	}

	instance.IsLoaded = false
	instance.Status = model.StatusUnloaded

	log.Printf("[REGISTRY] Model unloaded successfully: %s-%s", instance.Name, instance.Version)
	return nil
}

// GetModel 获取模型实例（支持延迟加载）
// 设计意图：支持延迟加载，如果模型未加载则自动加载
func (r *ModelRegistry) GetModel(name, version string) (*model.ModelInstance, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if versions, exists := r.models[name]; exists {
		if instance, exists := versions[version]; exists {
			// 检查模型状态
			switch instance.Status {
			case model.StatusReady:
				// 模型已就绪，更新使用时间并增加连接计数
				instance.LastUsedAt = time.Now()
				atomic.AddInt32(&instance.ActiveConnections, 1)
				return instance, nil

			case model.StatusUnloaded:
				// 模型已卸载，触发延迟加载
				log.Printf("[REGISTRY] Triggering lazy load for model: %s-%s", name, version)
				if err := r.loadModel(context.Background(), instance); err != nil {
					return nil, fmt.Errorf("failed to lazy load model: %w", err)
				}
				atomic.AddInt32(&instance.ActiveConnections, 1)
				return instance, nil

			case model.StatusLoading:
				// 模型正在加载中，等待加载完成
				return nil, fmt.Errorf("model is still loading")

			case model.StatusDeprecated:
				// 模型已废弃，不提供服务
				return nil, fmt.Errorf("model is deprecated")

			default:
				return nil, fmt.Errorf("model status is invalid: %s", instance.Status)
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
		LastUsedAt:  time.Now(),
		IdleTimeout: 1 * time.Minute, // 使用相同的空闲超时时间
		IsLoaded:    false,
	}

	// 初始化新版本
	if err := newInstance.Initialize(); err != nil {
		return err
	}

	// 启动新版本模型进程
	if err := r.loadModel(ctx, newInstance); err != nil {
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

			// 为现有模型设置默认值（兼容性处理）
			if instanceCopy.LastUsedAt.IsZero() {
				instanceCopy.LastUsedAt = instanceCopy.CreatedAt
			}
			if instanceCopy.IdleTimeout == 0 {
				instanceCopy.IdleTimeout = 1 * time.Minute
			}
			// 如果IsLoaded为false且状态为ready，说明是现有模型，设置为已加载
			if !instanceCopy.IsLoaded && instanceCopy.Status == model.StatusReady {
				instanceCopy.IsLoaded = true
			}

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

// CheckIdleModels 检查并卸载空闲模型
// 设计意图：自动卸载长时间未使用的模型，释放资源
func (r *ModelRegistry) CheckIdleModels() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for name, versions := range r.models {
		for version, instance := range versions {
			// 为现有模型设置默认值（兼容性处理）
			if instance.LastUsedAt.IsZero() {
				instance.LastUsedAt = instance.CreatedAt
			}
			if instance.IdleTimeout == 0 {
				instance.IdleTimeout = 1 * time.Minute
			}
			// 如果IsLoaded为false且状态为ready，说明是现有模型，设置为已加载
			if !instance.IsLoaded && instance.Status == model.StatusReady {
				instance.IsLoaded = true
			}

			// 卸载条件：ready状态 + 无活跃连接 + 超过空闲超时时间
			if instance.Status == model.StatusReady &&
				instance.ActiveConnections == 0 &&
				instance.IsLoaded &&
				time.Since(instance.LastUsedAt) > instance.IdleTimeout {

				log.Printf("[REGISTRY] Unloading idle model: %s-%s (idle for %v)",
					name, version, time.Since(instance.LastUsedAt))

				// 卸载模型
				if err := r.unloadModel(instance); err != nil {
					log.Printf("[REGISTRY][ERROR] Failed to unload idle model %s-%s: %v", name, version, err)
				}
			}
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
			r.CheckIdleModels() // 检查并卸载空闲模型
		}
	}()
}

// GetProcessStats 获取进程统计信息
func (r *ModelRegistry) GetProcessStats() map[string]interface{} {
	return r.processManager.GetProcessStats()
}
