package registry

import (
	"sync"
	"sync/atomic"
	"time"

	"pineai-project/internal/model"
)

// ModelRegistry 模型注册表
type ModelRegistry struct {
	models map[string]map[string]*model.ModelInstance // name -> version -> instance
	mu     sync.RWMutex
}

// NewModelRegistry 创建新的模型注册表
func NewModelRegistry() *ModelRegistry {
	return &ModelRegistry{
		models: make(map[string]map[string]*model.ModelInstance),
	}
}

// RegisterModel 注册模型
// 设计意图：支持动态模型注册，新注册的模型立即可用于推理
func (r *ModelRegistry) RegisterModel(req *model.ModelRegistrationRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()

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

	// 初始化模型
	if err := instance.Initialize(); err != nil {
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

// UpdateModel 热更新模型
// 设计意图：实现热更新机制，新版本立即生效，旧版本继续服务现有连接
func (r *ModelRegistry) UpdateModel(name, version string, config model.ModelConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 检查模型是否存在
	if versions, exists := r.models[name]; !exists {
		return model.ErrModelNotFound
	} else if _, exists := versions[version]; !exists {
		return model.ErrModelNotFound
	}

	// 创建新版本实例（状态为loading）
	newInstance := &model.ModelInstance{
		Name:        name,
		Version:     version,
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

	// 原子性替换：新版本状态设为ready，旧版本标记为deprecated
	versions := r.models[name]
	for v, instance := range versions {
		if v == version {
			// 标记旧版本为deprecated，但保持活跃连接
			instance.Status = model.StatusDeprecated
		}
	}

	// 注册新版本
	r.models[name][version] = newInstance
	newInstance.Status = model.StatusReady

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
