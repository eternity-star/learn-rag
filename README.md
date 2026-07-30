# learn-rag

前端转 AI 应用工程师的学习与实践仓库（LLM → RAG → Agent）。

当前已跑通：

- **阶段 1**：Vue 聊天壳 + Express SSE 代理 DeepSeek（OpenAI 兼容）
- **阶段 2 Week1**：手写最小 RAG（切分 → 本地 Embedding → JSON 索引 → 检索 → 带引用流式回答）

学习计划见 [learn.md](./learn.md)；给 AI / 协作者的详细上下文见 [AGENTS.md](./AGENTS.md)。

## 环境要求

| 工具 | 建议版本 |
|------|----------|
| Node.js | `v24.15.0`（`client` engines 要求 `^22.18.0` 或 `>=24.12.0`） |
| pnpm | `11.1.1` |

## 技术栈（已确定）

| 层 | 选型 |
|----|------|
| 前端 | Vue 3 + Vite + TypeScript + Naive UI + UnoCSS |
| 后端 | Node.js + Express + TypeScript |
| 模型 API | DeepSeek（OpenAI 兼容协议） |
| Embedding | 本地 `@xenova/transformers`（默认 `Xenova/bge-small-zh-v1.5`） |
| RAG 短期存储 | `server/data/chunks.json`（手写索引） |
| RAG 中期向量库 | pgvector（或托管库，尚未接入） |
| 包管理 | pnpm（workspace：`client` / `server`） |

## 项目目录

```text
learn-rag/
  client/                 # 前端：Vue 3 + Vite + TypeScript
  server/                 # 后端：Express + DeepSeek + RAG
    src/
      routes/             # chat / rag
      services/           # deepseek、chunk、embedding、indexer
      utils/              # errors、SSE（含 citations）
    data/
      docs/               # 知识库 Markdown 源文件
      chunks.json         # 构建出的向量索引（默认 gitignore）
    scripts/              # build-index / test-*
  pnpm-workspace.yaml
  README.md
  learn.md
  AGENTS.md
```

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

后端通过 `server/.env` 读取配置（**不要提交真实 Key**）。

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

EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=Xenova/bge-small-zh-v1.5
# 国内访问 Hugging Face 超时可设镜像
HF_ENDPOINT=https://hf-mirror.com
```

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | 必填。未配置时服务启动会直接报错提示 |
| `DEEPSEEK_BASE_URL` | OpenAI 兼容接口根地址 |
| `DEEPSEEK_MODEL` | 模型名，如 `deepseek-chat` |
| `PORT` | 后端端口，默认 `3000` |
| `EMBEDDING_MODEL` | 本地向量模型（Transformers.js） |
| `HF_ENDPOINT` | Hugging Face 镜像（可选） |

改完 `.env` 后需**重启 server**（`tsx watch` 默认不监听 `.env` 变更）。

## 启动 client + server

需要开两个终端：

```bash
# 终端 1：后端
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
浏览器访问 `http://localhost:1688` 即可联调（当前聊天页默认走 RAG 流式接口）。

### 构建 RAG 索引

首次或更新 `server/data/docs/*.md` 后，在 `server/` 执行：

```bash
pnpm exec tsx scripts/build-index.ts
```

会生成 / 覆盖 `server/data/chunks.json`（已在 `.gitignore` 中，需本地自行构建）。

常用接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/rag/stream` | **主路径**：检索 + 引用 + SSE 流式回答 |
| POST | `/api/chat/stream` | 纯聊天 SSE（不检索） |
| POST | `/api/chat/index` | 纯聊天非流式 |
| GET | `/health` | 健康检查 |

## 架构与数据流

当前主路径（知识库问答）：

```text
Chat.vue
  → POST /api/rag/stream（fetchEventSource）
  → Vite proxy → Express /api/rag/stream
  → retrieve(Top-K) → 拼 RAG system prompt（低分则拒答）
  → OpenAI SDK（stream:true）→ DeepSeek
  → SSE：先 { citations }，再 { content } 增量 → 前端展示引用 + 正文
```

索引侧：

```text
data/docs/*.md → chunk（字数窗口 + overlap）
  → embed（本地 bge-small-zh）→ chunks.json
  → 提问时 load + 余弦/点积 Top-K
```

前端要点：

- 流式：`@microsoft/fetch-event-source` + `AbortController`（可停止生成）
- 失败可一键重试上一句（不重复插入用户气泡）
- 可选 System Prompt：简洁 / 详细 / 翻译 / 结构化
- RAG 引用：消息气泡下展示 `source` / 片段 / `score`

后端要点：

- 先读流第一块再写 SSE 头，尽量让鉴权错误以非 200 JSON 返回
- RAG：`MIN_SCORE` 阈值过滤；无相关资料时约束模型拒答、不编造
- 空流 / 流内 `error` 会转为明确错误文案给前端

## 学习进度（摘要）

| 阶段 | 状态 |
|------|------|
| 0 定位 | 完成 |
| 1 LLM 基础（流式 Chat） | 完成 |
| 2 Week1 手写最小 RAG + 前端引用 | **主闭环已完成** |
| 2 Week2+（上传/pgvector/评测表等） | 进行中 / 待做 |
| 3 Agent | 未开始 |

下一步建议：简易评测表（20 问）+ 失败案例记录；再做文档上传/重建索引或检索质量优化。详见 `learn.md`。

## 已知问题

- **历史会话未接新后端**：`ChatRecord` 仍偏向旧 `/process/ai/*` 接口；左右栏会话切换与消息回填未完全打通。
- **RAG Week2+ 未做**：尚无上传/删除 API、无 pgvector；索引靠脚本重建本地 JSON。
- **缺正式评测记录**：还没有固定题集与引用准确率对比表。
- **语音输入遗留**：`Chat.vue` 中录音 / WebSocket 相关逻辑未完成，可能不可用。
- **部分网关“假成功”**：个别兼容网关在错误 Key 时仍返回 200 空流；后端会尽量识别为空内容错误。
- **改 `.env` 需重启 server**；根目录暂无统一 `dev` 一键脚本。

## 暂不使用（当前阶段）

- Nuxt 作为主后端
- Hono
- 未完成 RAG 评测与工程化前不上 LangChain / Multi-Agent
