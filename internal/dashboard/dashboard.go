package dashboard

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"pineai-project/internal/metrics"
	"pineai-project/internal/registry"

	"github.com/gin-gonic/gin"
)

// Dashboard 管理面板
type Dashboard struct {
	registry *registry.ModelRegistry
	metrics  *metrics.Metrics
}

// NewDashboard 创建新的管理面板
func NewDashboard(registry *registry.ModelRegistry, metrics *metrics.Metrics) *Dashboard {
	return &Dashboard{
		registry: registry,
		metrics:  metrics,
	}
}

// ModelInfo 模型信息
type ModelInfo struct {
	Name              string    `json:"name"`
	Version           string    `json:"version"`
	BackendType       string    `json:"backend_type"`
	Status            string    `json:"status"`
	ActiveConnections int       `json:"active_connections"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	Config            struct {
		ModelName   string  `json:"model_name"`
		MaxTokens   int     `json:"max_tokens"`
		Temperature float64 `json:"temperature"`
	} `json:"config"`
}

// DashboardData 面板数据
type DashboardData struct {
	Models           []ModelInfo `json:"models"`
	TotalModels      int         `json:"total_models"`
	ReadyModels      int         `json:"ready_models"`
	TotalConnections int         `json:"total_connections"`
	LastUpdated      time.Time   `json:"last_updated"`
}

// ShowTerminalUI 显示终端UI
func (d *Dashboard) ShowTerminalUI() {
	// 清屏
	d.clearScreen()

	fmt.Println("🚀 PineAI Backend 管理面板")
	fmt.Println(strings.Repeat("=", 50))

	// 获取模型列表
	models := d.registry.ListModels()

	// 统计信息
	totalModels := len(models.Models)
	readyModels := 0
	totalConnections := 0

	fmt.Printf("📊 统计信息:\n")
	fmt.Printf("  总模型数: %d\n", totalModels)

	// 显示每个模型的信息
	fmt.Printf("\n📋 模型列表:\n")
	fmt.Printf("%-20s %-10s %-15s %-10s %-6s %-8s %-15s\n",
		"模型名", "版本", "后端类型", "状态", "端口", "连接数", "更新时间")
	fmt.Printf("%-20s %-10s %-15s %-10s %-6s %-8s %-15s\n",
		"----", "----", "----", "----", "----", "----", "----")

	for modelName, versions := range models.Models {
		for version, model := range versions {
			status := "❌ 未就绪"
			if model.Status == "ready" {
				status = "✅ 就绪"
				readyModels++
			}

			connections := int(model.ActiveConnections)
			totalConnections += connections

			updatedTime := model.UpdatedAt.Format("15:04:05")

			// 获取端口号
			port := "-"
			if proc, ok := d.registry.GetModelProcess(modelName, version); ok {
				port = fmt.Sprintf("%d", proc.Port)
			}

			fmt.Printf("%-20s %-10s %-15s %-10s %-6s %-8d %-15s\n",
				modelName, version, model.BackendType, status, port, connections, updatedTime)
		}
	}

	fmt.Printf("\n📈 实时指标:\n")
	fmt.Printf("  就绪模型数: %d\n", readyModels)
	fmt.Printf("  总连接数: %d\n", totalConnections)
	fmt.Printf("  更新时间: %s\n", time.Now().Format("2006-01-02 15:04:05"))

	fmt.Printf("\n💡 提示:\n")
	fmt.Printf("  - 按 Ctrl+C 退出\n")
	fmt.Printf("  - 访问 http://localhost:3000 查看前端管理界面\n")
	fmt.Printf("  - 访问 http://localhost:8080/api/v1/dashboard 查看API数据\n")
	fmt.Printf("  - 访问 http://localhost:8080/metrics 查看 Prometheus 指标\n")
}

// clearScreen 清屏
func (d *Dashboard) clearScreen() {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "cls")
	default:
		cmd = exec.Command("clear")
	}
	cmd.Stdout = os.Stdout
	cmd.Run()
}

// SetupWebRoutes 设置网页路由
func (d *Dashboard) SetupWebRoutes(r *gin.Engine) {
	// API 路由
	api := r.Group("/api/v1")
	{
		// 获取面板数据
		api.GET("/dashboard", d.GetDashboardData)
		// 获取模型详情
		api.GET("/dashboard/models/:name/version/:version", d.GetModelDetail)
	}

	// 静态文件路由（用于网页版管理面板）
	r.Static("/static", "./web/static")
	r.LoadHTMLGlob("web/templates/*")

	// 网页版管理面板首页
	r.GET("/dashboard", d.ServeDashboardPage)
}

// GetDashboardData 获取面板数据
func (d *Dashboard) GetDashboardData(c *gin.Context) {
	models := d.registry.ListModels()

	var modelInfos []ModelInfo
	totalConnections := 0
	readyModels := 0

	for modelName, versions := range models.Models {
		for version, model := range versions {
			modelInfo := ModelInfo{
				Name:              modelName,
				Version:           version,
				BackendType:       string(model.BackendType),
				Status:            string(model.Status),
				ActiveConnections: int(model.ActiveConnections),
				CreatedAt:         model.CreatedAt,
				UpdatedAt:         model.UpdatedAt,
			}

			// 复制配置信息
			modelInfo.Config.ModelName = model.Config.ModelName
			modelInfo.Config.MaxTokens = model.Config.MaxTokens
			modelInfo.Config.Temperature = model.Config.Temperature

			modelInfos = append(modelInfos, modelInfo)

			totalConnections += int(model.ActiveConnections)
			if model.Status == "ready" {
				readyModels++
			}
		}
	}

	dashboardData := DashboardData{
		Models:           modelInfos,
		TotalModels:      len(modelInfos),
		ReadyModels:      readyModels,
		TotalConnections: totalConnections,
		LastUpdated:      time.Now(),
	}

	c.JSON(http.StatusOK, dashboardData)
}

// GetModelDetail 获取模型详情
func (d *Dashboard) GetModelDetail(c *gin.Context) {
	name := c.Param("name")
	version := c.Param("version")

	model, err := d.registry.GetModel(name, version)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "model not found"})
		return
	}

	modelInfo := ModelInfo{
		Name:              name,
		Version:           version,
		BackendType:       string(model.Config.BackendType),
		Status:            "ready", // 如果能获取到，说明是就绪状态
		ActiveConnections: 0,       // 这里需要从registry获取实际连接数
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	modelInfo.Config.ModelName = model.Config.ModelName
	modelInfo.Config.MaxTokens = model.Config.MaxTokens
	modelInfo.Config.Temperature = model.Config.Temperature

	c.JSON(http.StatusOK, modelInfo)
}

// ServeDashboardPage 提供网页版管理面板
func (d *Dashboard) ServeDashboardPage(c *gin.Context) {
	c.HTML(http.StatusOK, "dashboard.html", gin.H{
		"title": "PineAI Backend 管理面板",
	})
}
