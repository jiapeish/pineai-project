#!/bin/bash

# PineAI 多模型托管与推理平台停止脚本

echo "🛑 正在停止 PineAI 平台服务..."

# 停止后端服务
echo "🖥️  停止后端服务..."
pkill -f pineai-server

# 停止前端服务
echo "🌐 停止前端服务..."
pkill -f "react-scripts start"

# 停止所有模型进程
echo "🤖 停止所有模型进程..."
pkill -f "model_"

# 等待进程完全停止
sleep 2

# 检查是否还有相关进程在运行
BACKEND_RUNNING=$(pgrep -f pineai-server)
FRONTEND_RUNNING=$(pgrep -f "react-scripts start")
MODEL_PROCESSES=$(pgrep -f "model_")

if [ -z "$BACKEND_RUNNING" ] && [ -z "$FRONTEND_RUNNING" ] && [ -z "$MODEL_PROCESSES" ]; then
    echo "✅ 所有服务已成功停止"
else
    echo "⚠️  部分进程可能仍在运行:"
    if [ ! -z "$BACKEND_RUNNING" ]; then
        echo "   后端进程: $BACKEND_RUNNING"
    fi
    if [ ! -z "$FRONTEND_RUNNING" ]; then
        echo "   前端进程: $FRONTEND_RUNNING"
    fi
    if [ ! -z "$MODEL_PROCESSES" ]; then
        echo "   模型进程: $MODEL_PROCESSES"
    fi
    echo ""
    echo "💡 如需强制停止，请运行:"
    echo "   pkill -9 -f pineai-server"
    echo "   pkill -9 -f 'react-scripts start'"
    echo "   pkill -9 -f 'model_'"
fi

echo ""
echo "🧹 清理临时文件..."
rm -f server.log
rm -f web/frontend.log
rm -f model_*.log

echo "✅ 清理完成" 