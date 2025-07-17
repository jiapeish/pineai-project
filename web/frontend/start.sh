#!/bin/bash

# PineAI 前端启动脚本

echo "🚀 启动 PineAI 前端应用..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js 16+"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到npm，请先安装npm"
    exit 1
fi

# 检查Node.js版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ 错误: Node.js版本过低，需要16+版本"
    echo "当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js版本: $(node -v)"
echo "✅ npm版本: $(npm -v)"

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在web/frontend目录下运行此脚本"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 检查后端服务是否运行
echo "🔍 检查后端服务..."
if curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo "✅ 后端服务运行正常"
else
    echo "⚠️  警告: 后端服务未运行或无法访问"
    echo "   请确保后端服务在 http://localhost:8080 运行"
    echo "   前端将尝试连接到后端..."
fi

# 启动开发服务器
echo "🌐 启动开发服务器..."
echo "   前端地址: http://localhost:3000"
echo "   后端API: http://localhost:8080"
echo "   按 Ctrl+C 停止服务"
echo ""

npm start 