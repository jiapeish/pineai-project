#!/bin/bash

# 简单的模型版本热更新测试
BASE_URL="http://localhost:8080/api/v1"

echo "🧪 简单热更新测试"
echo "=================="

# 1. 注册模型 v1
echo "📝 注册模型 v1"
curl -X POST "${BASE_URL}/models" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-model",
    "version": "v1",
    "backend_type": "openai",
    "config": {
      "model_name": "gpt-4",
      "api_key": "use_config_default",
      "max_tokens": 100
    }
  }'

echo ""
echo "⏳ 等待启动..."
sleep 3

# 2. 热更新到 v2
echo ""
echo "🔄 热更新到 v2"
curl -X PUT "${BASE_URL}/models/test-model/version/v1" \
  -H "Content-Type: application/json" \
  -d '{
    "new_version": "v2",
    "config": {
      "backend_type": "openai",
      "model_name": "gpt-4",
      "api_key": "use_config_default",
      "max_tokens": 200
    }
  }'

echo ""
echo "⏳ 等待新版本启动..."
sleep 3

# 3. 查看模型列表
echo ""
echo "📋 查看模型列表"
curl -X GET "${BASE_URL}/models"

echo ""
echo "✅ 测试完成" 