package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"pineai-project/internal/dashboard"
	"pineai-project/internal/handler"
	"pineai-project/internal/metrics"
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

	// 创建指标管理器
	metricsManager := metrics.NewMetrics()

	// 创建管理面板
	dashboard := dashboard.NewDashboard(registry, metricsManager)

	// 启动清理协程
	registry.StartCleanupRoutine()

	// 启动终端UI更新协程
	go func() {
		for {
			dashboard.ShowTerminalUI()
			time.Sleep(5 * time.Second) // 每5秒更新一次
		}
	}()

	// 创建HTTP处理器
	handler := handler.NewHandler(registry, appConfig, metricsManager)

	// 创建Gin引擎
	r := gin.New()

	// 添加中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// 设置路由
	handler.SetupRoutes(r)

	// 设置管理面板路由
	dashboard.SetupWebRoutes(r)

	// 添加 Prometheus metrics 路由
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// 获取服务器地址
	serverAddr := appConfig.GetServerAddress()

	// 在goroutine中启动服务器
	go func() {
		log.Printf("Starting PineAI Backend server on %s", serverAddr)
		log.Printf("📊 Prometheus metrics: http://%s/metrics", serverAddr)
		log.Printf("🎛️  Management dashboard: http://%s/dashboard", serverAddr)
		log.Printf("📋 API dashboard: http://%s/api/v1/dashboard", serverAddr)

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
