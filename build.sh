#!/bin/bash

# PineAI Backend 构建脚本

echo "🔨 构建 PineAI Backend 服务..."

# 设置构建参数
BUILD_DIR="build"
MAIN_SERVER="pineai-server"
MODEL_SERVER="pineai-model"

# 创建构建目录
mkdir -p $BUILD_DIR

echo "📦 构建主服务进程..."
go build -o $BUILD_DIR/$MAIN_SERVER cmd/server/main.go
if [ $? -eq 0 ]; then
    echo "✅ 主服务进程构建成功: $BUILD_DIR/$MAIN_SERVER"
else
    echo "❌ 主服务进程构建失败"
    exit 1
fi

echo "📦 构建模型进程..."
go build -o $BUILD_DIR/$MODEL_SERVER cmd/model/main.go
if [ $? -eq 0 ]; then
    echo "✅ 模型进程构建成功: $BUILD_DIR/$MODEL_SERVER"
else
    echo "❌ 模型进程构建失败"
    exit 1
fi

echo ""
echo "🎉 构建完成！"
echo "============="
echo "主服务进程: $BUILD_DIR/$MAIN_SERVER"
echo "模型进程: $BUILD_DIR/$MODEL_SERVER"
echo ""
echo "启动主服务:"
echo "  ./$BUILD_DIR/$MAIN_SERVER"
echo ""
echo "运行测试:"
echo "  ./test/golang_process_test.sh" 