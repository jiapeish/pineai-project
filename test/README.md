# PineAI Backend 测试工具

本文件夹仅包含 PineAI Backend 的核心功能测试脚本。

## 📁 文件说明

### 1. `core_features_test.sh` - 核心功能测试脚本
**功能**: 全面测试 PineAI 后端的核心能力，覆盖如下内容：
- 模型注册/更新能力（动态注册、查看、更新，不影响 stream 请求）
- 推理接口（支持流式返回）
- 并发支持（多个请求、多个模型间不冲突）
- 热更新稳定性（更新期间已有连接不报错、不被终止）
- API 规范（请求体、返回格式清晰，REST 语义合理）

**测试模型**: 只测试真实 OpenAI 模型（gpt-4o、o4-mini），不再包含 mock 或 Gemini 测试。

**使用方法**:
```bash
chmod +x test/core_features_test.sh
./test/core_features_test.sh
```

## 🚀 使用步骤

1. 启动服务器
在config/config.yaml里填充真实的API-KEY
```bash
go run cmd/main.go
```
2. 运行测试脚本
```bash
./test/core_features_test.sh
```

## 📋 测试检查清单
- [ ] 服务器启动正常
- [ ] 健康检查接口响应
- [ ] 模型注册成功（gpt-4o、o4-mini）
- [ ] 模型列表查询正常
- [ ] OpenAI 流式输出正常
- [ ] 并发请求、热更新、API 规范

## 🔧 故障排除

1. **服务器未启动**
   ```bash
   go run cmd/main.go
   ```
2. **权限问题**
   ```bash
   chmod +x test/core_features_test.sh
   ```
3. **端口被占用**
   ```bash
   lsof -i :8080
   kill -9 <PID>
   ```

## 📝 测试报告
- 所有接口返回 200 状态码
- 流式输出实时显示
- 模型注册和查询正常
- 热更新功能正常
- 错误处理合理

---

**提示**: 本目录只保留 `core_features_test.sh`，所有测试均基于真实 OpenAI API。 