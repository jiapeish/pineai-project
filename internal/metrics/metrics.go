package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics 指标管理器
type Metrics struct {
	// 请求计数器
	requestCounter *prometheus.CounterVec
	// 请求延迟直方图
	requestDuration *prometheus.HistogramVec
	// 活跃连接数
	activeConnections *prometheus.GaugeVec
	// 模型状态
	modelStatus *prometheus.GaugeVec
}

// NewMetrics 创建新的指标管理器
func NewMetrics() *Metrics {
	return &Metrics{
		// 请求计数器：按模型名、版本、状态统计
		requestCounter: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "pineai_requests_total",
				Help: "Total number of requests by model and status",
			},
			[]string{"model", "version", "status"},
		),
		// 请求延迟直方图：按模型名、版本统计
		requestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "pineai_request_duration_seconds",
				Help:    "Request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"model", "version"},
		),
		// 活跃连接数：按模型名、版本统计
		activeConnections: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "pineai_active_connections",
				Help: "Number of active connections by model",
			},
			[]string{"model", "version"},
		),
		// 模型状态：1=ready, 0=not_ready
		modelStatus: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "pineai_model_status",
				Help: "Model status (1=ready, 0=not_ready)",
			},
			[]string{"model", "version", "backend_type"},
		),
	}
}

// RecordRequest 记录请求
func (m *Metrics) RecordRequest(model, version, status string, duration time.Duration) {
	// 记录请求计数
	m.requestCounter.WithLabelValues(model, version, status).Inc()

	// 记录请求延迟
	m.requestDuration.WithLabelValues(model, version).Observe(duration.Seconds())
}

// SetActiveConnections 设置活跃连接数
func (m *Metrics) SetActiveConnections(model, version string, count int) {
	m.activeConnections.WithLabelValues(model, version).Set(float64(count))
}

// SetModelStatus 设置模型状态
func (m *Metrics) SetModelStatus(model, version, backendType string, isReady bool) {
	status := 0.0
	if isReady {
		status = 1.0
	}
	m.modelStatus.WithLabelValues(model, version, backendType).Set(status)
}

// GetMetricsSummary 获取指标摘要（用于管理面板）
func (m *Metrics) GetMetricsSummary() map[string]interface{} {
	// 这里可以添加自定义的指标聚合逻辑
	// 目前返回基本结构，实际实现可以根据需要扩展
	return map[string]interface{}{
		"total_requests":     "从 Prometheus 查询",
		"avg_response_time":  "从 Prometheus 查询",
		"error_rate":         "从 Prometheus 查询",
		"active_connections": "从 Prometheus 查询",
	}
}
