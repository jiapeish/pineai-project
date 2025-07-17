#!/bin/bash

# PineAI 多模型托管与推理平台启动脚本

echo "🚀 启动 PineAI 多模型托管与推理平台..."

# 检查Go环境
if ! command -v go &> /dev/null; then
    echo "❌ 错误: 未找到 Go 环境，请先安装 Go"
    exit 1
fi

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js 环境，请先安装 Node.js"
    exit 1
fi

# 检查npm环境
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm，请先安装 npm"
    exit 1
fi

echo "✅ 环境检查通过"

# 构建后端
echo "🔨 构建后端服务..."
if [ ! -f "./build/pineai-server" ]; then
    echo "📦 首次构建，请稍候..."
    ./build.sh
fi

if [ ! -f "./build/pineai-server" ]; then
    echo "❌ 后端构建失败"
    exit 1
fi

echo "✅ 后端构建完成"

# 检查前端依赖
echo "📦 检查前端依赖..."
cd web/frontend
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 启动后端服务
echo "🖥️  启动后端服务..."
cd ../..
./build/pineai-server > server.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
echo "⏳ 等待后端服务启动..."
sleep 3

# 检查后端是否启动成功
if ! curl -s http://localhost:8080/api/v1/health > /dev/null; then
    echo "❌ 后端服务启动失败，请检查 server.log"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ 后端服务启动成功 (PID: $BACKEND_PID)"

# 启动前端服务
echo "🌐 启动前端服务..."
cd web/frontend
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
echo "⏳ 等待前端服务启动..."
sleep 5

# 检查前端是否启动成功
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 前端服务启动失败，请检查 frontend.log"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 1
fi

echo "✅ 前端服务启动成功 (PID: $FRONTEND_PID)"

echo ""
echo "🎉 PineAI 平台启动完成！"
echo ""
echo "📊 服务地址:"
echo "   前端管理界面: http://localhost:3000"
echo "   后端API: http://localhost:8080"
echo ""
echo "📋 快速开始:"
echo "   1. 打开浏览器访问 http://localhost:3000"
echo "   2. 在模型管理页面注册您的第一个模型"
echo "   3. 使用推理测试页面测试模型"
echo ""
echo "📝 日志文件:"
echo "   后端日志: server.log"
echo "   前端日志: web/frontend.log"
echo ""
echo "🛑 停止服务:"
echo "   按 Ctrl+C 停止所有服务"
echo "   或运行: pkill -f pineai-server && pkill -f 'react-scripts start'"
echo ""

# 等待用户中断
trap 'echo ""; echo "🛑 正在停止服务..."; kill $BACKEND_PID 2>/dev/null; kill $FRONTEND_PID 2>/dev/null; echo "✅ 服务已停止"; exit 0' INT

# 保持脚本运行
wait 