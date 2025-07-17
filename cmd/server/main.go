package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"

	"pineai-project/internal/handler"
	"pineai-project/internal/registry"
	"pineai-project/pkg/config"
)

func main() {
	// 加载配置文件
	appConfig, err := config.LoadConfig("")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 设置Gin模式
	gin.SetMode(gin.ReleaseMode)

	// 创建模型注册表
	registry := registry.NewModelRegistry()

	// 启动清理协程
	registry.StartCleanupRoutine()

	// 创建HTTP处理器
	handler := handler.NewHandler(registry, appConfig)

	// 创建Gin引擎
	r := gin.New()

	// 添加中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// 设置路由
	handler.SetupRoutes(r)

	// 获取服务器地址
	serverAddr := appConfig.GetServerAddress()

	// 在goroutine中启动服务器
	go func() {
		log.Printf("Starting PineAI Backend server on %s", serverAddr)
		if err := r.Run(serverAddr); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
}
