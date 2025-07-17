package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"pineai-project/internal/model"
	"pineai-project/internal/streamer"
	"pineai-project/pkg/config"
)

// ModelServer 模型服务
type ModelServer struct {
	modelInstance *model.ModelInstance
	streamer      streamer.Streamer
	port          int
	server        *http.Server
}

// NewModelServer 创建新的模型服务
func NewModelServer(modelInstance *model.ModelInstance, port int) (*ModelServer, error) {
	// 尝试多个可能的配置文件路径
	possiblePaths := []string{
		"config/config.yaml",       // 当前目录
		"../config/config.yaml",    // 上级目录
		"../../config/config.yaml", // 上上级目录
	}

	var appConfig *config.Config
	var configErr error

	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			fmt.Printf("[DEBUG] Found config file at: %s\n", path)
			appConfig, configErr = config.LoadConfig(path)
			if configErr == nil {
				break
			} else {
				fmt.Printf("[DEBUG] Failed to load config from %s: %v\n", path, configErr)
			}
		} else {
			fmt.Printf("[DEBUG] Config file not found at: %s\n", path)
		}
	}

	if appConfig == nil {
		return nil, fmt.Errorf("failed to load config from any path: %v", configErr)
	}

	// 创建流式推理器
	streamerFactory := streamer.NewStreamerFactory(appConfig)
	streamerInstance, err := streamerFactory.CreateStreamer(modelInstance.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create streamer: %w", err)
	}

	return &ModelServer{
		modelInstance: modelInstance,
		streamer:      streamerInstance,
		port:          port,
	}, nil
}

// Start 启动模型服务
func (ms *ModelServer) Start() error {
	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)

	// 创建路由
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(cors.Default())

	// 设置路由
	ms.setupRoutes(router)

	// 创建HTTP服务器
	ms.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", ms.port),
		Handler: router,
	}

	// 启动服务器
	log.Printf("Starting model server for %s v%s on port %d",
		ms.modelInstance.Name, ms.modelInstance.Version, ms.port)

	go func() {
		if err := ms.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Model server error: %v", err)
		}
	}()

	return nil
}

// Stop 停止模型服务
func (ms *ModelServer) Stop() error {
	log.Printf("Stopping model server for %s v%s",
		ms.modelInstance.Name, ms.modelInstance.Version)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return ms.server.Shutdown(ctx)
}

// setupRoutes 设置路由
func (ms *ModelServer) setupRoutes(router *gin.Engine) {
	// 健康检查
	router.GET("/health", ms.healthCheck)

	// 推理接口
	router.POST("/infer", ms.infer)
}

// healthCheck 健康检查
func (ms *ModelServer) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"model":   ms.modelInstance.Name,
		"version": ms.modelInstance.Version,
		"backend": ms.modelInstance.BackendType,
		"port":    ms.port,
		"config":  ms.modelInstance.Config,
	})
}

// infer 推理接口
func (ms *ModelServer) infer(c *gin.Context) {
	var req model.InferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[MODEL_SERVER][ERROR] Failed to bind JSON request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("invalid request: %v", err),
		})
		return
	}

	log.Printf("[MODEL_SERVER] Received inference request: model=%s, version=%s, input=%s", req.Model, req.Version, req.Input)

	// 设置SSE响应头
	streamer.WriteSSEHeaders(c)

	// 创建上下文，支持超时控制
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	// 执行流式推理
	err := ms.streamer.StreamInference(ctx, req.Input, c.Writer)
	if err != nil {
		// 如果客户端已断开连接，不返回错误
		if ctx.Err() == context.Canceled {
			log.Printf("[MODEL_SERVER] Client disconnected, canceling inference")
			return
		}

		log.Printf("[MODEL_SERVER][ERROR] Stream inference failed: %v", err)
		// 发送错误信息，但不让进程崩溃
		errorData := fmt.Sprintf("data: {\"error\": \"%s\"}\n\n", err.Error())
		c.Writer.Write([]byte(errorData))
	} else {
		log.Printf("[MODEL_SERVER] Inference completed successfully")
	}
}

func main() {
	// 从环境变量获取配置
	modelName := os.Getenv("MODEL_NAME")
	modelVersion := os.Getenv("MODEL_VERSION")
	backendType := os.Getenv("MODEL_BACKEND")
	portStr := os.Getenv("MODEL_PORT")
	configJSON := os.Getenv("MODEL_CONFIG")

	if modelName == "" || modelVersion == "" || backendType == "" || portStr == "" {
		log.Fatal("Missing required environment variables: MODEL_NAME, MODEL_VERSION, MODEL_BACKEND, MODEL_PORT")
	}

	// 解析端口
	var port int
	if _, err := fmt.Sscanf(portStr, "%d", &port); err != nil {
		log.Fatalf("Invalid port: %s", portStr)
	}

	// 解析配置
	var modelConfig model.ModelConfig
	if configJSON != "" {
		if err := json.Unmarshal([]byte(configJSON), &modelConfig); err != nil {
			log.Fatalf("Invalid config JSON: %v", err)
		}
	}

	// 设置默认配置
	if modelConfig.BackendType == "" {
		modelConfig.BackendType = model.BackendType(backendType)
	}

	// 创建模型实例
	modelInstance := &model.ModelInstance{
		Name:        modelName,
		Version:     modelVersion,
		BackendType: model.BackendType(backendType),
		Status:      model.StatusReady,
		Config:      modelConfig,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 初始化模型
	if err := modelInstance.Initialize(); err != nil {
		log.Fatalf("Failed to initialize model: %v", err)
	}

	// 创建模型服务
	modelServer, err := NewModelServer(modelInstance, port)
	if err != nil {
		log.Fatalf("Failed to create model server: %v", err)
	}

	// 启动模型服务
	if err := modelServer.Start(); err != nil {
		log.Fatalf("Failed to start model server: %v", err)
	}

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// 优雅关闭
	if err := modelServer.Stop(); err != nil {
		log.Printf("Error stopping model server: %v", err)
	}

	log.Printf("Model server for %s v%s stopped", modelName, modelVersion)
}
