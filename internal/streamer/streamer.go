package streamer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"

	"pineai-project/internal/model"
	"pineai-project/pkg/config"
)

// Streamer 流式推理器接口
type Streamer interface {
	StreamInference(ctx context.Context, input string, writer io.Writer) error
}

// OpenAIStreamer OpenAI流式推理器
type OpenAIStreamer struct {
	client *openai.Client
	config model.ModelConfig
}

// NewOpenAIStreamer 创建OpenAI流式推理器
func NewOpenAIStreamer(modelConfig model.ModelConfig, appConfig *config.Config) *OpenAIStreamer {
	// 使用配置文件中的API密钥，如果模型配置中没有提供或标记为使用默认配置
	apiKey := modelConfig.APIKey
	if apiKey == "" || apiKey == "use_config_default" {
		apiKey = appConfig.GetOpenAIKey()
		if apiKey == "" {
			fmt.Printf("[ERROR] OpenAI API key is empty!\n")
		} else if len(apiKey) >= 10 {
			fmt.Printf("[DEBUG] Using config default OpenAI API key: %s...\n", apiKey[:10])
		} else {
			fmt.Printf("[DEBUG] Using config default OpenAI API key: %s\n", apiKey)
		}
	} else {
		if apiKey == "" {
			fmt.Printf("[ERROR] Model-specific OpenAI API key is empty!\n")
		} else if len(apiKey) >= 10 {
			fmt.Printf("[DEBUG] Using model-specific OpenAI API key: %s...\n", apiKey[:10])
		} else {
			fmt.Printf("[DEBUG] Using model-specific OpenAI API key: %s\n", apiKey)
		}
	}

	// 打印模型配置信息
	fmt.Printf("[DEBUG] Model config - Name: %s, BackendType: %s, MaxTokens: %d, Temperature: %f\n",
		modelConfig.ModelName, modelConfig.BackendType, modelConfig.MaxTokens, modelConfig.Temperature)

	// go-openai v1.17.9 只支持通过NewClient传递API Key，暂不支持自定义BaseURL
	client := openai.NewClient(apiKey)
	fmt.Printf("[DEBUG] OpenAI client created successfully\n")

	return &OpenAIStreamer{
		client: client,
		config: modelConfig,
	}
}

// StreamInference 执行OpenAI流式推理
func (s *OpenAIStreamer) StreamInference(ctx context.Context, input string, writer io.Writer) error {
	fmt.Printf("[DEBUG] Starting OpenAI stream inference\n")
	fmt.Printf("[DEBUG] Input text: %s\n", input)

	modelName := s.config.ModelName
	if modelName == "" {
		// 默认使用 gpt-4o，因为你的密钥支持这个模型
		modelName = "gpt-4o"
		fmt.Printf("[DEBUG] Using default model: %s\n", modelName)
	} else {
		fmt.Printf("[DEBUG] Using configured model: %s\n", modelName)
	}

	req := openai.ChatCompletionRequest{
		Model:     modelName,
		Messages:  []openai.ChatCompletionMessage{{Role: openai.ChatMessageRoleUser, Content: input}},
		Stream:    true,
		MaxTokens: s.config.MaxTokens,
	}

	if s.config.Temperature > 0 {
		req.Temperature = float32(s.config.Temperature)
	}

	// 打印详细的请求信息
	fmt.Printf("[DEBUG] OpenAI request details:\n")
	fmt.Printf("[DEBUG]   Model: %s\n", modelName)
	fmt.Printf("[DEBUG]   MaxTokens: %d\n", s.config.MaxTokens)
	fmt.Printf("[DEBUG]   Temperature: %f\n", s.config.Temperature)
	fmt.Printf("[DEBUG]   Stream: %t\n", req.Stream)
	fmt.Printf("[DEBUG]   Messages count: %d\n", len(req.Messages))
	fmt.Printf("[DEBUG]   First message role: %s\n", req.Messages[0].Role)
	fmt.Printf("[DEBUG]   First message content length: %d\n", len(req.Messages[0].Content))

	fmt.Printf("[DEBUG] Creating OpenAI chat completion stream...\n")
	stream, err := s.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		// 更详细的错误信息
		fmt.Printf("[ERROR] Failed to create OpenAI stream: %v\n", err)
		return fmt.Errorf("failed to create chat completion stream: %w (model: %s)", err, modelName)
	}
	defer stream.Close()

	fmt.Printf("[DEBUG] OpenAI stream created successfully\n")

	// 使用SSE格式发送流式数据
	// 设计意图：使用Server-Sent Events实现流式响应，比WebSocket更适合单向数据推送
	fmt.Printf("[DEBUG] Starting to receive stream data...\n")
	tokenCount := 0

	for {
		response, err := stream.Recv()
		if err == io.EOF {
			fmt.Printf("[DEBUG] Stream ended (EOF), total tokens received: %d\n", tokenCount)
			break
		}
		if err != nil {
			fmt.Printf("[ERROR] Stream receive error: %v\n", err)
			return fmt.Errorf("stream recv error: %w", err)
		}

		// 发送SSE格式数据
		content := response.Choices[0].Delta.Content
		if content != "" {
			tokenCount++
			fmt.Printf("[DEBUG] Received token %d: '%s'\n", tokenCount, content)

			sseData := fmt.Sprintf("data: %s\n\n", content)
			if _, err := writer.Write([]byte(sseData)); err != nil {
				fmt.Printf("[ERROR] Failed to write SSE data: %v\n", err)
				return fmt.Errorf("failed to write SSE data: %w", err)
			}
		}
	}

	// 发送结束标记
	fmt.Printf("[DEBUG] Sending stream end marker\n")
	endData := "data: [DONE]\n\n"
	writer.Write([]byte(endData))

	fmt.Printf("[DEBUG] OpenAI stream inference completed successfully\n")

	return nil
}

// GeminiStreamer Gemini流式推理器
type GeminiStreamer struct {
	config     model.ModelConfig
	appConfig  *config.Config
	httpClient *http.Client
}

// GeminiRequest Gemini API请求结构
type GeminiRequest struct {
	Contents         []GeminiContent        `json:"contents"`
	GenerationConfig GeminiGenerationConfig `json:"generationConfig,omitempty"`
}

// GeminiContent Gemini内容结构
type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

// GeminiPart Gemini部分结构
type GeminiPart struct {
	Text string `json:"text"`
}

// GeminiGenerationConfig Gemini生成配置
type GeminiGenerationConfig struct {
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
	Temperature     float64 `json:"temperature,omitempty"`
}

// GeminiResponse Gemini API响应结构
type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
}

// GeminiCandidate Gemini候选结构
type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

// NewGeminiStreamer 创建Gemini流式推理器
func NewGeminiStreamer(modelConfig model.ModelConfig, appConfig *config.Config) (*GeminiStreamer, error) {
	return &GeminiStreamer{
		config:    modelConfig,
		appConfig: appConfig,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}, nil
}

// StreamInference 执行Gemini流式推理
func (s *GeminiStreamer) StreamInference(ctx context.Context, input string, writer io.Writer) error {
	// 使用配置文件中的API密钥
	apiKey := s.config.APIKey
	if apiKey == "" || apiKey == "use_config_default" {
		apiKey = s.appConfig.GetGeminiKey()
	}

	modelName := s.config.ModelName
	if modelName == "" {
		modelName = "gemini-pro"
	}

	// 构建请求
	reqBody := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: input},
				},
			},
		},
		GenerationConfig: GeminiGenerationConfig{
			MaxOutputTokens: s.config.MaxTokens,
			Temperature:     s.config.Temperature,
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// 创建HTTP请求
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelName, apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("Gemini API error: %s, body: %s", resp.Status, string(body))
	}

	// 解析响应
	var geminiResp GeminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	// 提取文本内容并流式输出
	for _, candidate := range geminiResp.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.Text != "" {
				// 按字符分割，模拟流式输出
				tokens := strings.Split(part.Text, "")
				for _, token := range tokens {
					select {
					case <-ctx.Done():
						return ctx.Err()
					default:
						sseData := fmt.Sprintf("data: %s\n\n", token)
						if _, err := writer.Write([]byte(sseData)); err != nil {
							return fmt.Errorf("failed to write SSE data: %w", err)
						}
						// 模拟50ms延迟，让流式效果更明显
						time.Sleep(50 * time.Millisecond)
					}
				}
			}
		}
	}

	// 发送结束标记
	endData := "data: [DONE]\n\n"
	writer.Write([]byte(endData))

	return nil
}

// MockStreamer Mock流式推理器
type MockStreamer struct {
	config model.ModelConfig
}

// NewMockStreamer 创建Mock流式推理器
func NewMockStreamer(config model.ModelConfig) *MockStreamer {
	return &MockStreamer{
		config: config,
	}
}

// StreamInference 执行Mock流式推理
// 设计意图：模拟LLM推理过程，用于测试和演示
func (s *MockStreamer) StreamInference(ctx context.Context, input string, writer io.Writer) error {
	// 模拟响应内容
	response := fmt.Sprintf("这是对'%s'的模拟回复。我正在模拟LLM的流式输出过程，每个token之间有200ms的延迟。", input)

	// 按字符分割，模拟token输出
	tokens := strings.Split(response, "")

	for _, token := range tokens {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// 发送SSE格式数据
			sseData := fmt.Sprintf("data: %s\n\n", token)
			if _, err := writer.Write([]byte(sseData)); err != nil {
				return fmt.Errorf("failed to write SSE data: %w", err)
			}

			// 模拟200ms延迟
			time.Sleep(200 * time.Millisecond)
		}
	}

	// 发送结束标记
	endData := "data: [DONE]\n\n"
	writer.Write([]byte(endData))

	return nil
}

// StreamerFactory 流式推理器工厂
type StreamerFactory struct {
	appConfig *config.Config
}

// NewStreamerFactory 创建流式推理器工厂
func NewStreamerFactory(appConfig *config.Config) *StreamerFactory {
	return &StreamerFactory{
		appConfig: appConfig,
	}
}

// CreateStreamer 根据后端类型创建对应的流式推理器
func (f *StreamerFactory) CreateStreamer(config model.ModelConfig) (Streamer, error) {
	fmt.Printf("[DEBUG] Creating streamer for backend type: %s\n", config.BackendType)

	switch config.BackendType {
	case model.BackendOpenAI:
		fmt.Printf("[DEBUG] Creating OpenAI streamer\n")
		return NewOpenAIStreamer(config, f.appConfig), nil
	case model.BackendGemini:
		fmt.Printf("[DEBUG] Creating Gemini streamer\n")
		return NewGeminiStreamer(config, f.appConfig)
	case model.BackendMock:
		fmt.Printf("[DEBUG] Creating Mock streamer\n")
		return NewMockStreamer(config), nil
	default:
		fmt.Printf("[ERROR] Unsupported backend type: %s\n", config.BackendType)
		return nil, fmt.Errorf("unsupported backend type: %s", config.BackendType)
	}
}

// WriteSSEHeaders 写入SSE响应头
func WriteSSEHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
}
