package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Config 配置结构体
type Config struct {
	APIKeys APIKeysConfig `yaml:"api_keys"`
	Server  ServerConfig  `yaml:"server"`
	Models  ModelsConfig  `yaml:"models"`
}

// APIKeysConfig API密钥配置
type APIKeysConfig struct {
	OpenAI OpenAIConfig `yaml:"openai"`
	Gemini GeminiConfig `yaml:"gemini"`
}

// OpenAIConfig OpenAI配置
type OpenAIConfig struct {
	Key string `yaml:"key"`
}

// GeminiConfig Gemini配置
type GeminiConfig struct {
	Key string `yaml:"key"`
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port int    `yaml:"port"`
	Host string `yaml:"host"`
}

// ModelsConfig 模型配置
type ModelsConfig struct {
	OpenAI ModelBackendConfig `yaml:"openai"`
	Gemini ModelBackendConfig `yaml:"gemini"`
}

// ModelBackendConfig 模型后端配置
type ModelBackendConfig struct {
	DefaultModel string  `yaml:"default_model"`
	MaxTokens    int     `yaml:"max_tokens"`
	Temperature  float64 `yaml:"temperature"`
}

// LoadConfig 加载配置文件
func LoadConfig(configPath string) (*Config, error) {
	// 如果配置文件路径为空，使用默认路径
	if configPath == "" {
		configPath = "config/config.yaml"
	}

	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// 解析YAML
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// 验证配置
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return &config, nil
}

// Validate 验证配置
func (c *Config) Validate() error {
	// 验证API密钥
	if c.APIKeys.OpenAI.Key == "" {
		return fmt.Errorf("OpenAI API key is required")
	}
	if c.APIKeys.Gemini.Key == "" {
		return fmt.Errorf("Gemini API key is required")
	}

	// 验证服务器配置
	if c.Server.Port <= 0 {
		c.Server.Port = 8080
	}
	if c.Server.Host == "" {
		c.Server.Host = "0.0.0.0"
	}

	return nil
}

// GetOpenAIKey 获取OpenAI API密钥
func (c *Config) GetOpenAIKey() string {
	return c.APIKeys.OpenAI.Key
}

// GetGeminiKey 获取Gemini API密钥
func (c *Config) GetGeminiKey() string {
	return c.APIKeys.Gemini.Key
}

// GetServerAddress 获取服务器地址
func (c *Config) GetServerAddress() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}
