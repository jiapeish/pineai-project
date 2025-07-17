package handler

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"pineai-project/internal/model"
	"pineai-project/internal/registry"
	"pineai-project/internal/streamer"
	"pineai-project/pkg/config"
)

// Handler HTTP处理器
type Handler struct {
	registry        *registry.ModelRegistry
	streamerFactory *streamer.StreamerFactory
}

// NewHandler 创建新的HTTP处理器
func NewHandler(registry *registry.ModelRegistry, appConfig *config.Config) *Handler {
	return &Handler{
		registry:        registry,
		streamerFactory: streamer.NewStreamerFactory(appConfig),
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

	err := h.registry.RegisterModel(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to register model: %v", err),
		})
		return
	}

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
	c.JSON(http.StatusOK, models)
}

// UpdateModel 热更新模型
// PUT /models/{name}/version/{version}
func (h *Handler) UpdateModel(c *gin.Context) {
	name := c.Param("name")
	version := c.Param("version")

	var req model.ModelUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("invalid request: %v", err),
		})
		return
	}

	err := h.registry.UpdateModel(name, version, req.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to update model: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "model updated successfully",
		"model": gin.H{
			"name":    name,
			"version": version,
			"status":  "ready",
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

	c.JSON(http.StatusOK, gin.H{
		"message": "model deleted successfully",
	})
}

// StreamInference 流式推理
// POST /infer
// 设计意图：实现流式推理接口，支持SSE协议，确保热更新不影响现有连接
func (h *Handler) StreamInference(c *gin.Context) {
	fmt.Printf("[DEBUG] Received inference request\n")

	var req model.InferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("[ERROR] Failed to bind JSON request: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("invalid request: %v", err),
		})
		return
	}

	fmt.Printf("[DEBUG] Inference request - Model: %s, Version: %s, Input: %s\n",
		req.Model, req.Version, req.Input)

	// 获取模型实例
	modelInstance, err := h.registry.GetModel(req.Model, req.Version)
	if err != nil {
		fmt.Printf("[ERROR] Model not found: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("model not found: %v", err),
		})
		return
	}

	fmt.Printf("[DEBUG] Model found - Name: %s, BackendType: %s\n",
		modelInstance.Config.ModelName, modelInstance.Config.BackendType)

	// 确保连接结束时释放模型
	defer h.registry.ReleaseModel(req.Model, req.Version)

	// 设置SSE响应头
	streamer.WriteSSEHeaders(c)
	fmt.Printf("[DEBUG] SSE headers set\n")

	// 创建流式推理器
	fmt.Printf("[DEBUG] Creating streamer for backend type: %s\n", modelInstance.Config.BackendType)
	streamerInstance, err := h.streamerFactory.CreateStreamer(modelInstance.Config)
	if err != nil {
		fmt.Printf("[ERROR] Failed to create streamer: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("failed to create streamer: %v", err),
		})
		return
	}

	fmt.Printf("[DEBUG] Streamer created successfully\n")

	// 创建上下文，支持超时控制
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	// 执行流式推理
	fmt.Printf("[DEBUG] Starting stream inference...\n")
	err = streamerInstance.StreamInference(ctx, req.Input, c.Writer)
	if err != nil {
		// 如果客户端已断开连接，不返回错误
		if ctx.Err() == context.Canceled {
			fmt.Printf("[DEBUG] Client disconnected, canceling inference\n")
			return
		}

		fmt.Printf("[ERROR] Stream inference failed: %v\n", err)
		// 发送错误信息
		errorData := fmt.Sprintf("data: {\"error\": \"%s\"}\n\n", err.Error())
		c.Writer.Write([]byte(errorData))
	} else {
		fmt.Printf("[DEBUG] Stream inference completed successfully\n")
	}
}

// HealthCheck 健康检查
// GET /health
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"message": "PineAI Backend is running",
	})
}

// SetupRoutes 设置路由
func (h *Handler) SetupRoutes(r *gin.Engine) {
	// API路由组
	api := r.Group("/api/v1")
	{
		// 模型管理
		api.POST("/models", h.RegisterModel)
		api.GET("/models", h.ListModels)
		api.PUT("/models/:name/version/:version", h.UpdateModel)
		api.DELETE("/models/:name/version/:version", h.DeleteModel)

		// 推理接口
		api.POST("/infer", h.StreamInference)

		// 健康检查
		api.GET("/health", h.HealthCheck)
	}

	// 根路径重定向到健康检查
	r.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/api/v1/health")
	})
}
