package model

import (
	"time"
)

// ModelStatus 模型状态枚举
type ModelStatus string

const (
	StatusLoading    ModelStatus = "loading"    // 加载中
	StatusReady      ModelStatus = "ready"      // 可用
	StatusUpdating   ModelStatus = "updating"   // 更新中
	StatusDeprecated ModelStatus = "deprecated" // 已废弃（但仍有活跃连接）
	StatusDeleted    ModelStatus = "deleted"    // 已删除
)

// BackendType 后端类型枚举
type BackendType string

const (
	BackendOpenAI BackendType = "openai"
	BackendGemini BackendType = "gemini"
	BackendMock   BackendType = "mock"
)

// ModelConfig 模型配置
type ModelConfig struct {
	BackendType BackendType `json:"backend_type"`
	APIKey      string      `json:"api_key,omitempty"`
	BaseURL     string      `json:"base_url,omitempty"`
	ModelName   string      `json:"model_name,omitempty"` // 对应后端的模型名称
	MaxTokens   int         `json:"max_tokens,omitempty"`
	Temperature float64     `json:"temperature,omitempty"`
}

// ModelInstance 模型实例
type ModelInstance struct {
	Name              string      `json:"name"`
	Version           string      `json:"version"`
	BackendType       BackendType `json:"backend_type"`
	Status            ModelStatus `json:"status"`
	Config            ModelConfig `json:"config"`
	ActiveConnections int32       `json:"active_connections"` // 原子计数器
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
}

// InferenceRequest 推理请求
type InferenceRequest struct {
	Model   string `json:"model" binding:"required"`
	Version string `json:"version" binding:"required"`
	Input   string `json:"input" binding:"required"`
}

// ModelRegistrationRequest 模型注册请求
type ModelRegistrationRequest struct {
	Name        string      `json:"name" binding:"required"`
	Version     string      `json:"version" binding:"required"`
	BackendType BackendType `json:"backend_type" binding:"required"`
	Config      ModelConfig `json:"config"`
}

// ModelUpdateRequest 模型更新请求
type ModelUpdateRequest struct {
	NewVersion string      `json:"new_version" binding:"required"` // 新版本号
	Config     ModelConfig `json:"config" binding:"required"`      // 新配置
}

// ModelListResponse 模型列表响应
type ModelListResponse struct {
	Models map[string]map[string]*ModelInstance `json:"models"`
}

// Initialize 初始化模型实例
func (m *ModelInstance) Initialize() error {
	// 根据后端类型进行相应的初始化
	switch m.BackendType {
	case BackendOpenAI:
		return m.initializeOpenAI()
	case BackendGemini:
		return m.initializeGemini()
	case BackendMock:
		return m.initializeMock()
	default:
		return nil
	}
}

// initializeOpenAI 初始化OpenAI后端
func (m *ModelInstance) initializeOpenAI() error {
	// 验证API key和配置
	if m.Config.APIKey == "" {
		return ErrInvalidConfig
	}
	return nil
}

// initializeGemini 初始化Gemini后端
func (m *ModelInstance) initializeGemini() error {
	// 验证API key和配置
	if m.Config.APIKey == "" {
		return ErrInvalidConfig
	}
	return nil
}

// initializeMock 初始化Mock后端
func (m *ModelInstance) initializeMock() error {
	// Mock后端无需特殊初始化
	return nil
}

// 错误定义
var (
	ErrInvalidConfig = &ModelError{Message: "invalid model configuration"}
	ErrModelNotFound = &ModelError{Message: "model not found"}
	ErrModelNotReady = &ModelError{Message: "model not ready"}
)

// ModelError 模型错误
type ModelError struct {
	Message string
}

func (e *ModelError) Error() string {
	return e.Message
}
