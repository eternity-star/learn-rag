# learn-rag

前端转 AI 应用工程师的学习与实践仓库（LLM → RAG → Agent）。

当前已跑通：**Vue 聊天壳 + Express SSE 代理 DeepSeek（OpenAI 兼容协议）**。

## 环境要求

| 工具 | 建议版本 |
|------|----------|
| Node.js | `v24.15.0`（`client` engines 要求 `^22.18.0` 或 `>=24.12.0`） |
| pnpm | `11.1.1` |

## 安装

仓库为 pnpm workspace（`client` / `server`），可在根目录一次安装：

```bash
pnpm install
```

也可分别安装：

```bash
cd client && pnpm install
cd ../server && pnpm install
```

## 如何配置 Key

后端通过 `server/.env` 读取模型配置（**不要提交真实 Key**）。

1. 复制示例文件：

```bash
cp server/.env.example server/.env
```

2. 编辑 `server/.env`：

```env
PORT=3000
DEEPSEEK_API_KEY=sk-your-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | 必填。未配置时服务启动会直接报错提示 |
| `DEEPSEEK_BASE_URL` | OpenAI 兼容接口根地址（官方 DeepSeek 或自建网关） |
| `DEEPSEEK_MODEL` | 模型名，如 `deepseek-chat` |
| `PORT` | 后端端口，默认 `3000` |

改完 `.env` 后需**重启 server**（`tsx watch` 默认不监听 `.env` 变更）。

## 启动 client + server

需要开两个终端：

```bash
# 终端 1：后端 SSE / 聊天 API
cd server
pnpm dev
# → http://localhost:3000
# 健康检查：GET /health → ok

# 终端 2：前端
cd client
pnpm dev
# → http://localhost:1688
```

前端已配置 Vite 代理：`/api` → `http://localhost:3000`。  
浏览器访问 `http://localhost:1688` 即可联调流式对话。

常用接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat/stream` | SSE 流式聊天 |
| POST | `/api/chat/index` | 非流式聊天 |
| GET | `/health` | 健康检查 |

## 架构

```text
learn-rag/
├── client/                 # 前端 Vue 3 + Vite + TS + Naive UI + UnoCSS
│   └── src/
│       ├── views/ai-agent/ # 聊天页（AiChat / Chat / ChatRecord）
│       ├── services/       # HTTP / API 封装
│       ├── constants/      # 如 System Prompt 选项
│       └── types/          # 共享类型
├── server/                 # 后端 Express + TS
│   └── src/
│       ├── routes/         # 路由（薄层）
│       ├── services/       # DeepSeek / OpenAI SDK 调用
│       └── utils/          # errors、SSE 工具
├── pnpm-workspace.yaml
├── AGENTS.md               # 给 AI / 协作者的详细上下文
└── learn.md                # 学习路线
```

数据流（当前主路径）：

```text
Chat.vue
  → POST /api/chat/stream（fetchEventSource）
  → Vite proxy → Express /api/chat/stream
  → OpenAI SDK（stream:true）→ DeepSeek / 兼容网关
  → SSE data: {"content":"..."} → 前端逐字渲染
```

前端要点：

- 流式：`@microsoft/fetch-event-source` + `AbortController`（可停止生成）
- 失败可一键重试上一句（不重复插入用户气泡）
- 可选 System Prompt：简洁 / 详细 / 翻译（写入 messages 最前的 `role: system`）

后端要点：

- 先读流第一块再写 SSE 头，尽量让鉴权错误以非 200 JSON 返回
- 空流 / 流内 `error` 会转为明确错误文案给前端

更细的模块说明见 [AGENTS.md](./AGENTS.md)，学习计划见 [learn.md](./learn.md)。

## 已知问题

- **历史会话未接新后端**：`ChatRecord` 仍偏向旧 `/process/ai/*` 接口；左右栏会话切换与消息回填未完全打通。
- **RAG 未落地**：短期 JSON/内存与中期 pgvector 仍在规划中（见 `learn.md`）。
- **语音输入遗留**：`Chat.vue` 中录音 / WebSocket 相关逻辑未完成，可能不可用。
- **部分网关“假成功”**：个别兼容网关在错误 Key 时仍返回 200 空流；后端会尽量识别为空内容错误，但表现依赖上游行为。
- **改 `.env` 需重启 server**：环境变量在进程启动时加载。
- **Workspace 根脚本**：根目录暂无统一 `dev` 一键脚本，需分别启动 client / server。

## 暂不使用（当前阶段）

- Nuxt 作为主后端
- Hono
- 未手写通 RAG 前不上 LangChain / Multi-Agent
