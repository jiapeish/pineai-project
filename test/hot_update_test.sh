#!/bin/bash

# 模型版本热更新测试脚本
# 测试 PUT /models/{name}/version/{version} 接口

BASE_URL="http://localhost:8080/api/v1"
MODEL_NAME="gpt-4-test"
OLD_VERSION="v1"
NEW_VERSION="v2"

echo "🧪 开始模型版本热更新测试"
echo "=================================="

# 1. 注册初始模型
echo "📝 1. 注册初始模型 ${MODEL_NAME}:${OLD_VERSION}"
curl -X POST "${BASE_URL}/models" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'${MODEL_NAME}'",
    "version": "'${OLD_VERSION}'",
    "backend_type": "openai",
    "config": {
      "model_name": "gpt-4",
      "api_key": "use_config_default",
      "max_tokens": 1000,
      "temperature": 0.7
    }
  }' | jq '.'

echo ""
echo "⏳ 等待模型启动..."
sleep 3

# 2. 验证初始模型
echo "✅ 2. 验证初始模型"
curl -X GET "${BASE_URL}/models" | jq '.models["'${MODEL_NAME}'"]'

echo ""
echo "🔍 3. 查看进程列表"
curl -X GET "${BASE_URL}/processes" | jq '.'

# 3. 测试初始模型推理
echo ""
echo "🤖 4. 测试初始模型推理"
curl -X POST "${BASE_URL}/infer" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'${MODEL_NAME}'",
    "version": "'${OLD_VERSION}'",
    "input": "Hello from old version"
  }' | jq '.'

echo ""
echo "⏳ 等待推理完成..."
sleep 2

# 4. 执行热更新（版本号变更）
echo ""
echo "🔄 5. 执行热更新：${OLD_VERSION} -> ${NEW_VERSION}"
curl -X PUT "${BASE_URL}/models/${MODEL_NAME}/version/${OLD_VERSION}" \
  -H "Content-Type: application/json" \
  -d '{
    "new_version": "'${NEW_VERSION}'",
    "config": {
      "backend_type": "openai",
      "model_name": "gpt-4",
      "api_key": "use_config_default",
      "max_tokens": 2000,
      "temperature": 0.8
    }
  }' | jq '.'

echo ""
echo "⏳ 等待新版本启动..."
sleep 5

# 5. 验证更新后的模型列表
echo ""
echo "✅ 6. 验证更新后的模型列表"
curl -X GET "${BASE_URL}/models" | jq '.models["'${MODEL_NAME}'"]'

echo ""
echo "🔍 7. 查看更新后的进程列表"
curl -X GET "${BASE_URL}/processes" | jq '.'

# 6. 测试新版本推理
echo ""
echo "🤖 8. 测试新版本推理"
curl -X POST "${BASE_URL}/infer" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'${MODEL_NAME}'",
    "version": "'${NEW_VERSION}'",
    "input": "Hello from new version"
  }' | jq '.'

# 7. 测试旧版本仍然可用（如果有活跃连接）
echo ""
echo "🤖 9. 测试旧版本是否仍然可用"
curl -X POST "${BASE_URL}/infer" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'${MODEL_NAME}'",
    "version": "'${OLD_VERSION}'",
    "input": "Hello from deprecated version"
  }' | jq '.'

echo ""
echo "📊 10. 查看统计信息"
curl -X GET "${BASE_URL}/stats" | jq '.'

echo ""
echo "🎉 热更新测试完成！"
echo "=================================="
echo "📋 测试总结："
echo "  - 初始版本: ${MODEL_NAME}:${OLD_VERSION}"
echo "  - 新版本: ${MODEL_NAME}:${NEW_VERSION}"
echo "  - 旧版本应该被标记为 deprecated"
echo "  - 新版本应该可以正常推理"
echo "  - 两个版本应该同时存在" 