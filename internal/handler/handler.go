package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"pineai-project/internal/metrics"
	"pineai-project/internal/model"
	"pineai-project/internal/registry"
	"pineai-project/internal/streamer"
	"pineai-project/pkg/config"
)

// Handler HTTP处理器
type Handler struct {
	registry        *registry.ModelRegistry
	streamerFactory *streamer.StreamerFactory
	metrics         *metrics.Metrics
}

// NewHandler 创建新的HTTP处理器
func NewHandler(registry *registry.ModelRegistry, appConfig *config.Config, metrics *metrics.Metrics) *Handler {
	return &Handler{
		registry:        registry,
		streamerFactory: streamer.NewStreamerFactory(appConfig),
		metrics:         metrics,
	}
}

// RegisterModel 注册模型
// POST /models
func (h *Handler) RegisterModel(c *gin.Context) {
	var req model.ModelRegistrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("invalid request: %v", err),
		})
		return
	}

	// 设置默认配置
	if req.Config.BackendType == "" {
		req.Config.BackendType = req.BackendType
	}

	// 如果API密钥为空，使用配置文件中的默认密钥
	if req.Config.APIKey == "" {
		switch req.BackendType {
		case model.BackendOpenAI:
			req.Config.APIKey = "use_config_default" // 标记使用配置文件中的密钥
		case model.BackendGemini:
			req.Config.APIKey = "use_config_default" // 标记使用配置文件中的密钥
		}
	}

	err := h.registry.RegisterModel(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to register model: %v", err),
		})
		return
	}

	// 记录模型状态指标
	h.metrics.SetModelStatus(req.Name, req.Version, string(req.BackendType), true)

	c.JSON(http.StatusOK, gin.H{
		"message": "model registered successfully",
		"model": gin.H{
			"name":    req.Name,
			"version": req.Version,
			"status":  "ready",
		},
	})
}

// ListModels 列出所有模型
// GET /models
func (h *Handler) ListModels(c *gin.Context) {
	models := h.registry.ListModels()

	// 将嵌套对象格式转换为数组格式，以适配前端期望
	var modelList []map[string]interface{}

	for name, versions := range models.Models {
		for version, instance := range versions {
			modelInfo := map[string]interface{}{
				"name":               name,
				"version":            version,
				"backend_type":       string(instance.BackendType),
				"status":             string(instance.Status),
				"active_connections": instance.ActiveConnections,
				"created_at":         instance.CreatedAt,
				"updated_at":         instance.UpdatedAt,
				"config": map[string]interface{}{
					"model_name":  instance.Config.ModelName,
					"max_tokens":  instance.Config.MaxTokens,
					"temperature": instance.Config.Temperature,
				},
			}
			modelList = append(modelList, modelInfo)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"models": modelList,
	})
}

// UpdateModel 热更新模型（支持版本号变更）
// PUT /models/{name}/version/{version}
func (h *Handler) UpdateModel(c *gin.Context) {
	name := c.Param("name")
	oldVersion := c.Param("version")

	var req model.ModelUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("invalid request: %v", err),
		})
		return
	}

	// 验证新版本号
	if req.NewVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "new_version is required",
		})
		return
	}

	// 如果新版本号与旧版本号相同，返回错误
	if req.NewVersion == oldVersion {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "new_version must be different from current version",
		})
		return
	}

	err := h.registry.UpdateModel(c.Request.Context(), name, oldVersion, req.NewVersion, req.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to update model: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "model updated successfully",
		"model": gin.H{
			"name":        name,
			"old_version": oldVersion,
			"new_version": req.NewVersion,
			"status":      "ready",
			"updated_at":  time.Now(),
		},
	})
}

// DeleteModel 删除模型
// DELETE /models/{name}/version/{version}
func (h *Handler) DeleteModel(c *gin.Context) {
	name := c.Param("name")
	version := c.Param("version")

	err := h.registry.DeleteModel(name, version)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to delete model: %v", err),
		})
		return
	}

	// 记录模型状态指标
	h.metrics.SetModelStatus(name, version, "", false)

	c.JSON(http.StatusOK, gin.H{
		"message": "model deleted successfully",
	})
}

// StreamInference 流式推理
// POST /infer
// 设计意图：实现流式推理接口，支持SSE协议，确保热更新不影响现有连接
func (h *Handler) StreamInference(c *gin.Context) {
	startTime := time.Now()
	status := "success"
	var req model.InferenceRequest

	defer func() {
		// 记录请求指标
		duration := time.Since(startTime)
		if req.Model != "" && req.Version != "" {
			h.metrics.RecordRequest(req.Model, req.Version, status, duration)
		}
	}()

	log.Printf("[HANDLER] Received inference request: %v", c.Request.Body)
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[HANDLER][ERROR] Failed to bind JSON request: %v", err)
		status = "error"
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("invalid request: %v", err),
		})
		return
	}

	log.Printf("[HANDLER] Inference request - Model: %s, Version: %s, Input: %s", req.Model, req.Version, req.Input)

	// 获取模型实例
	modelInstance, err := h.registry.GetModel(req.Model, req.Version)
	if err != nil {
		log.Printf("[HANDLER][ERROR] Model not found: %v", err)
		status = "error"
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("model not found: %v", err),
		})
		return
	}

	// 获取模型进程信息（用于推理）
	modelProcess, exists := h.registry.GetModelProcessForInference(req.Model, req.Version)
	if !exists {
		log.Printf("[HANDLER][ERROR] Model process not found: %s-%s", req.Model, req.Version)
		status = "error"
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "model process not available",
		})
		return
	}

	log.Printf("[HANDLER] Model found - Name: %s, BackendType: %s, Process Port: %d, Active Connections: %d", modelInstance.Config.ModelName, modelInstance.Config.BackendType, modelProcess.Port, modelProcess.ActiveConnections)

	// 确保连接结束时释放模型和进程连接
	defer func() {
		h.registry.ReleaseModel(req.Model, req.Version)
		h.registry.ReleaseModelProcess(req.Model, req.Version)
	}()

	// 设置SSE响应头
	streamer.WriteSSEHeaders(c)
	log.Printf("[HANDLER] SSE headers set")

	// 转发请求到模型进程
	log.Printf("[HANDLER] Forwarding request to model process on port %d", modelProcess.Port)
	err = h.forwardToModelProcess(c, modelProcess, req)
	if err != nil {
		log.Printf("[HANDLER][ERROR] Failed to forward to model process: %v", err)
		status = "error"
		return
	}

	log.Printf("[HANDLER] Request forwarded to model process successfully")
}

// forwardToModelProcess 转发请求到模型进程
func (h *Handler) forwardToModelProcess(c *gin.Context, modelProcess *model.ModelProcess, req model.InferenceRequest) error {
	// 构建转发请求
	forwardURL := fmt.Sprintf("http://localhost:%d/infer", modelProcess.Port)

	// 创建HTTP客户端
	client := &http.Client{
		Timeout: 60 * time.Second,
	}

	// 构建请求体
	requestBody := map[string]interface{}{
		"model":   req.Model,
		"version": req.Version,
		"input":   req.Input,
	}

	// 序列化请求体
	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建请求
	httpReq, err := http.NewRequest("POST", forwardURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// 发送请求到模型进程
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to forward request: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("model process returned status: %d", resp.StatusCode)
	}

	// 将模型进程的响应转发给客户端
	_, err = io.Copy(c.Writer, resp.Body)
	return err
}

// HealthCheck 健康检查
// GET /health
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"message": "PineAI Backend is running",
	})
}

// ListProcesses 列出所有模型进程
// GET /processes
func (h *Handler) ListProcesses(c *gin.Context) {
	processes := h.registry.ListProcesses()

	// 统计运行中的进程数
	runningProcesses := 0
	for _, process := range processes {
		if process.Status == "running" {
			runningProcesses++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"processes":         processes,
		"running_processes": runningProcesses,
		"total_processes":   len(processes),
	})
}

// GetProcessStats 获取进程统计信息
// GET /stats
func (h *Handler) GetProcessStats(c *gin.Context) {
	stats := h.registry.GetProcessStats()
	c.JSON(http.StatusOK, stats)
}

// SetupRoutes 设置路由
func (h *Handler) SetupRoutes(r *gin.Engine) {
	// API路由组
	api := r.Group("/api/v1")
	{
		// 健康检查
		api.GET("/health", h.HealthCheck)

		// 模型管理
		api.POST("/models", h.RegisterModel)
		api.GET("/models", h.ListModels)
		api.PUT("/models/:name/version/:version", h.UpdateModel)
		api.DELETE("/models/:name/version/:version", h.DeleteModel)

		// 推理接口
		api.POST("/infer", h.StreamInference)

		// 进程管理
		api.GET("/processes", h.ListProcesses)
		api.GET("/stats", h.GetProcessStats)
	}
}
