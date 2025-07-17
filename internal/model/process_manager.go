package model

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

// ModelProcess 表示一个独立的模型进程
type ModelProcess struct {
	ID                string                 `json:"id"`
	Name              string                 `json:"name"`
	Version           string                 `json:"version"`
	BackendType       string                 `json:"backend_type"`
	Config            map[string]interface{} `json:"config"`
	Port              int                    `json:"port"`
	Status            string                 `json:"status"` // running, stopping, stopped, error
	Process           *exec.Cmd              `json:"-"`
	StartTime         time.Time              `json:"start_time"`
	HealthURL         string                 `json:"health_url"`
	InferURL          string                 `json:"infer_url"`
	ActiveConnections int32                  `json:"active_connections"` // 原子计数器
	IsDeprecated      bool                   `json:"is_deprecated"`      // 是否已废弃（不再接收新请求）
	mu                sync.RWMutex           `json:"-"`
}

// ProcessManager 管理所有模型进程
type ProcessManager struct {
	processes map[string]*ModelProcess // key: modelID
	mu        sync.RWMutex
	basePort  int
	portMutex sync.Mutex
}

// NewProcessManager 创建新的进程管理器
func NewProcessManager(basePort int) *ProcessManager {
	return &ProcessManager{
		processes: make(map[string]*ModelProcess),
		basePort:  basePort,
	}
}

// StartModelProcess 启动一个新的模型进程
func (pm *ProcessManager) StartModelProcess(ctx context.Context, model *ModelInstance) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	modelID := fmt.Sprintf("%s-%s", model.Name, model.Version)

	log.Printf("[PROCESS_MANAGER] StartModelProcess called: modelID=%s", modelID)

	// 检查进程是否已存在
	if _, exists := pm.processes[modelID]; exists {
		log.Printf("[PROCESS_MANAGER][WARN] model process %s already exists", modelID)
		return fmt.Errorf("model process %s already exists", modelID)
	}

	// 分配端口
	port := pm.allocatePort()
	log.Printf("[PROCESS_MANAGER] Allocated port %d for model %s", port, modelID)

	// 创建模型进程
	process := &ModelProcess{
		ID:          modelID,
		Name:        model.Name,
		Version:     model.Version,
		BackendType: string(model.BackendType),
		Config: map[string]interface{}{
			"backend_type": string(model.BackendType),
			"api_key":      model.Config.APIKey,
			"base_url":     model.Config.BaseURL,
			"model_name":   model.Config.ModelName,
			"max_tokens":   model.Config.MaxTokens,
			"temperature":  model.Config.Temperature,
		},
		Port:              port,
		Status:            "starting",
		StartTime:         time.Now(),
		HealthURL:         fmt.Sprintf("http://localhost:%d/health", port),
		InferURL:          fmt.Sprintf("http://localhost:%d/infer", port),
		ActiveConnections: 0,
		IsDeprecated:      false,
	}

	// 启动进程
	log.Printf("[PROCESS_MANAGER] Starting process for model %s on port %d", modelID, port)
	if err := pm.startProcess(ctx, process); err != nil {
		log.Printf("[PROCESS_MANAGER][ERROR] failed to start model process: %v", err)
		return fmt.Errorf("failed to start model process: %w", err)
	}

	pm.processes[modelID] = process

	// 异步检查进程健康状态
	go pm.monitorProcessHealth(ctx, process)

	log.Printf("[PROCESS_MANAGER] Started model process: %s on port %d", modelID, port)
	return nil
}

// GetModelProcess 获取模型进程（优先返回非废弃的进程）
func (pm *ProcessManager) GetModelProcess(modelID string) (*ModelProcess, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	process, exists := pm.processes[modelID]
	if !exists {
		return nil, false
	}

	// 如果进程已废弃，返回false
	if process.IsDeprecated {
		return nil, false
	}

	return process, true
}

// GetModelProcessForInference 获取用于推理的模型进程
func (pm *ProcessManager) GetModelProcessForInference(modelID string) (*ModelProcess, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	process, exists := pm.processes[modelID]
	if !exists {
		return nil, false
	}

	// 如果进程已废弃，返回false
	if process.IsDeprecated {
		return nil, false
	}

	// 增加活跃连接计数
	atomic.AddInt32(&process.ActiveConnections, 1)

	return process, true
}

// ReleaseModelProcess 释放模型进程连接
func (pm *ProcessManager) ReleaseModelProcess(modelID string) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	process, exists := pm.processes[modelID]
	if !exists {
		return
	}

	// 减少活跃连接计数
	atomic.AddInt32(&process.ActiveConnections, -1)

	// 如果进程已废弃且无活跃连接，启动清理
	if process.IsDeprecated && atomic.LoadInt32(&process.ActiveConnections) == 0 {
		go pm.cleanupDeprecatedProcess(process)
	}
}

// UpdateModelProcess 更新模型进程（热更新）
func (pm *ProcessManager) UpdateModelProcess(ctx context.Context, model *ModelInstance) error {
	modelID := fmt.Sprintf("%s-%s", model.Name, model.Version)

	// 检查进程是否存在
	oldProcess, exists := pm.GetModelProcess(modelID)
	if !exists {
		return fmt.Errorf("model process %s not found", modelID)
	}

	// 创建新进程（使用新端口）
	newPort := pm.allocatePort()
	// 为新进程创建唯一的ID，避免与旧进程冲突
	newProcessID := fmt.Sprintf("%s-%s-%d", model.Name, model.Version, time.Now().Unix())
	newProcess := &ModelProcess{
		ID:          newProcessID, // 使用唯一的进程ID
		Name:        model.Name,
		Version:     model.Version,
		BackendType: string(model.BackendType),
		Config: map[string]interface{}{
			"backend_type": string(model.BackendType),
			"api_key":      model.Config.APIKey,
			"base_url":     model.Config.BaseURL,
			"model_name":   model.Config.ModelName,
			"max_tokens":   model.Config.MaxTokens,
			"temperature":  model.Config.Temperature,
		},
		Port:              newPort,
		Status:            "starting",
		StartTime:         time.Now(),
		HealthURL:         fmt.Sprintf("http://localhost:%d/health", newPort),
		InferURL:          fmt.Sprintf("http://localhost:%d/infer", newPort),
		ActiveConnections: 0,
		IsDeprecated:      false,
	}

	// 启动新进程
	if err := pm.startProcess(ctx, newProcess); err != nil {
		return fmt.Errorf("failed to start new model process: %w", err)
	}

	// 等待新进程就绪
	if err := pm.waitForProcessReady(newProcess); err != nil {
		// 停止新进程（使用新进程的ID）
		pm.StopModelProcess(newProcess.ID)
		return fmt.Errorf("new model process failed to start: %w", err)
	}

	// 标记旧进程为废弃（不再接收新请求）
	pm.mu.Lock()
	oldProcess.IsDeprecated = true
	// 将新进程添加到进程映射中，使用modelID作为键（用于路由）
	pm.processes[modelID] = newProcess // 新请求将路由到新进程
	// 同时保存新进程的完整引用，用于清理
	pm.processes[newProcessID] = newProcess
	pm.mu.Unlock()

	log.Printf("Updated model process: %s (old port: %d, new port: %d)", modelID, oldProcess.Port, newProcess.Port)
	log.Printf("Old process marked as deprecated, new requests will route to port %d", newPort)

	// 检查旧进程是否可以清理
	if atomic.LoadInt32(&oldProcess.ActiveConnections) == 0 {
		go pm.cleanupDeprecatedProcess(oldProcess)
	}

	return nil
}

// cleanupDeprecatedProcess 清理废弃的进程
func (pm *ProcessManager) cleanupDeprecatedProcess(process *ModelProcess) {
	log.Printf("Cleaning up deprecated process: %s on port %d", process.ID, process.Port)

	// 等待所有活跃连接完成
	for atomic.LoadInt32(&process.ActiveConnections) > 0 {
		log.Printf("Waiting for %d active connections to complete on process %s",
			atomic.LoadInt32(&process.ActiveConnections), process.ID)
		time.Sleep(1 * time.Second)
	}

	// 停止进程（使用进程的实际ID）
	if err := pm.StopModelProcess(process.ID); err != nil {
		log.Printf("Error stopping deprecated process %s: %v", process.ID, err)
	}
}

// StopModelProcess 停止模型进程
func (pm *ProcessManager) StopModelProcess(modelID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	process, exists := pm.processes[modelID]
	if !exists {
		return fmt.Errorf("model process %s not found", modelID)
	}

	process.mu.Lock()
	defer process.mu.Unlock()

	// 检查是否还有活跃连接
	if atomic.LoadInt32(&process.ActiveConnections) > 0 {
		return fmt.Errorf("cannot stop process %s: %d active connections", modelID, atomic.LoadInt32(&process.ActiveConnections))
	}

	if process.Process != nil && process.Process.Process != nil {
		// 优雅关闭进程
		if err := process.Process.Process.Signal(os.Interrupt); err != nil {
			log.Printf("Failed to send interrupt signal to process %s: %v", modelID, err)
			// 强制杀死进程
			if err := process.Process.Process.Kill(); err != nil {
				log.Printf("Failed to kill process %s: %v", modelID, err)
			}
		}

		// 等待进程结束
		done := make(chan error, 1)
		go func() {
			done <- process.Process.Wait()
		}()

		select {
		case <-done:
			log.Printf("Model process %s stopped gracefully", modelID)
		case <-time.After(10 * time.Second):
			log.Printf("Force killing model process %s", modelID)
			process.Process.Process.Kill()
		}
	}

	process.Status = "stopped"
	delete(pm.processes, modelID)

	log.Printf("Stopped model process: %s", modelID)
	return nil
}

// ListProcesses 列出所有进程
func (pm *ProcessManager) ListProcesses() []*ModelProcess {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	processes := make([]*ModelProcess, 0, len(pm.processes))
	for _, process := range pm.processes {
		processes = append(processes, process)
	}
	return processes
}

// startProcess 启动单个模型进程
func (pm *ProcessManager) startProcess(ctx context.Context, process *ModelProcess) error {
	// 获取当前可执行文件路径
	executable, err := os.Executable()
	if err != nil {
		log.Printf("[PROCESS_MANAGER][ERROR] failed to get executable path: %v", err)
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// 构建模型进程可执行文件路径 - 尝试多个可能的路径
	possiblePaths := []string{
		filepath.Join(filepath.Dir(executable), "pineai-model"), // 与主服务同目录
		"build/pineai-model",   // 项目根目录下的build目录
		"./build/pineai-model", // 相对路径
		"pineai-model",         // 当前目录
	}

	var modelExecutable string
	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			modelExecutable = path
			log.Printf("[PROCESS_MANAGER] Found model executable at: %s", modelExecutable)
			break
		}
	}

	if modelExecutable == "" {
		log.Printf("[PROCESS_MANAGER] Model executable not found, building...")
		// 构建模型进程
		buildCmd := exec.Command("go", "build", "-o", "build/pineai-model", "cmd/model/main.go")
		buildCmd.Dir = pm.getProjectRoot()
		buildCmd.Stdout = os.Stdout
		buildCmd.Stderr = os.Stderr

		if err := buildCmd.Run(); err != nil {
			log.Printf("[PROCESS_MANAGER][ERROR] failed to build model process: %v", err)
			return fmt.Errorf("failed to build model process: %w", err)
		}
		log.Printf("[PROCESS_MANAGER] Model executable built successfully.")
		modelExecutable = "build/pineai-model"
	}

	// 准备环境变量
	env := os.Environ()
	env = append(env, fmt.Sprintf("MODEL_PORT=%d", process.Port))
	env = append(env, fmt.Sprintf("MODEL_NAME=%s", process.Name))
	env = append(env, fmt.Sprintf("MODEL_VERSION=%s", process.Version))
	env = append(env, fmt.Sprintf("MODEL_BACKEND=%s", process.BackendType))

	// 序列化配置
	configJSON, _ := json.Marshal(process.Config)
	env = append(env, fmt.Sprintf("MODEL_CONFIG=%s", string(configJSON)))

	log.Printf("[PROCESS_MANAGER] Starting model process with env: MODEL_PORT=%d, MODEL_NAME=%s, MODEL_VERSION=%s, MODEL_BACKEND=%s", process.Port, process.Name, process.Version, process.BackendType)
	log.Printf("[PROCESS_MANAGER] MODEL_CONFIG=%s", string(configJSON))

	// 启动进程 - 不使用context，避免context取消导致的问题
	cmd := exec.Command(modelExecutable)
	cmd.Env = env
	cmd.Dir = pm.getProjectRoot() // 设置工作目录为项目根目录

	// 创建日志文件
	logFile, err := os.OpenFile(fmt.Sprintf("model_%s.log", process.ID), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("[PROCESS_MANAGER][ERROR] failed to create log file: %v", err)
		return fmt.Errorf("failed to create log file: %w", err)
	}

	// 将输出重定向到日志文件
	cmd.Stdout = logFile
	cmd.Stderr = logFile

	log.Printf("[PROCESS_MANAGER] About to start model process: %s", modelExecutable)
	if err := cmd.Start(); err != nil {
		log.Printf("[PROCESS_MANAGER][ERROR] failed to start process: %v", err)
		logFile.Close()
		return fmt.Errorf("failed to start process: %w", err)
	}

	process.Process = cmd
	process.Status = "running"

	log.Printf("[PROCESS_MANAGER] Model process started, pid=%d", cmd.Process.Pid)

	// 等待一小段时间，检查进程是否立即崩溃
	time.Sleep(100 * time.Millisecond)
	if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
		log.Printf("[PROCESS_MANAGER][ERROR] Model process exited immediately with state: %v", cmd.ProcessState)
		return fmt.Errorf("model process exited immediately")
	}

	return nil
}

// getProjectRoot 获取项目根目录
func (pm *ProcessManager) getProjectRoot() string {
	// 获取当前工作目录
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return wd
}

// allocatePort 分配可用端口
func (pm *ProcessManager) allocatePort() int {
	pm.portMutex.Lock()
	defer pm.portMutex.Unlock()

	// 简单的端口分配策略
	port := pm.basePort + len(pm.processes) + 1
	return port
}

// waitForProcessReady 等待进程就绪
func (pm *ProcessManager) waitForProcessReady(process *ModelProcess) error {
	timeout := 30 * time.Second
	interval := 1 * time.Second

	for timeout > 0 {
		resp, err := http.Get(process.HealthURL)
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}

		time.Sleep(interval)
		timeout -= interval
	}

	return fmt.Errorf("process failed to become ready within timeout")
}

// monitorProcessHealth 监控进程健康状态
func (pm *ProcessManager) monitorProcessHealth(ctx context.Context, process *ModelProcess) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Printf("[PROCESS_MANAGER] Starting health monitoring for process %s on port %d", process.ID, process.Port)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[PROCESS_MANAGER] Health monitoring stopped for process %s", process.ID)
			return
		case <-ticker.C:
			// 检查进程是否还在运行
			if process.Process != nil && process.Process.Process != nil {
				if process.Process.ProcessState != nil && process.Process.ProcessState.Exited() {
					process.mu.Lock()
					process.Status = "error"
					process.mu.Unlock()
					log.Printf("[PROCESS_MANAGER][ERROR] Model process %s has exited with state: %v", process.ID, process.Process.ProcessState)
					return
				}
			}

			// 检查健康状态
			resp, err := http.Get(process.HealthURL)
			if err != nil {
				process.mu.Lock()
				process.Status = "error"
				process.mu.Unlock()
				log.Printf("[PROCESS_MANAGER][ERROR] Model process %s health check failed: %v", process.ID, err)
			} else {
				resp.Body.Close()
				if resp.StatusCode != 200 {
					process.mu.Lock()
					process.Status = "error"
					process.mu.Unlock()
					log.Printf("[PROCESS_MANAGER][ERROR] Model process %s health check returned status: %d", process.ID, resp.StatusCode)
				} else {
					process.mu.Lock()
					if process.Status != "running" {
						process.Status = "running"
						log.Printf("[PROCESS_MANAGER] Model process %s is healthy", process.ID)
					}
					process.mu.Unlock()
				}
			}
		}
	}
}

// GetProcessStats 获取进程统计信息
func (pm *ProcessManager) GetProcessStats() map[string]interface{} {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	stats := map[string]interface{}{
		"total_processes":   len(pm.processes),
		"running":           0,
		"stopping":          0,
		"stopped":           0,
		"error":             0,
		"total_connections": 0,
	}

	for _, process := range pm.processes {
		process.mu.RLock()
		status := process.Status
		connections := atomic.LoadInt32(&process.ActiveConnections)
		process.mu.RUnlock()

		switch status {
		case "running":
			stats["running"] = stats["running"].(int) + 1
		case "stopping":
			stats["stopping"] = stats["stopping"].(int) + 1
		case "stopped":
			stats["stopped"] = stats["stopped"].(int) + 1
		case "error":
			stats["error"] = stats["error"].(int) + 1
		}

		stats["total_connections"] = stats["total_connections"].(int) + int(connections)
	}

	return stats
}
