# learn-rag

前端转 AI 应用工程师的学习与实践仓库（LLM → RAG → Agent）。

当前已跑通：

- **阶段 1**：Vue 聊天壳 + Express SSE 代理 DeepSeek（OpenAI 兼容）；停止生成 / 重试 / System Prompt / 结构化输出练习
- **阶段 2 Week1～4**：
  - 手写 RAG：标题切分 → 本地 Embedding → `chunks.json` → Hybrid 检索 → 拒答 → 带引用流式回答
  - 知识库管理页（上传 / 删除 / 重建索引）+ 引用预览 + 人工评测与复盘
  - **会话持久化**：后端 `conversations.json` + `/api/conversations/*`，左右栏新建 / 切换 / 删除已打通

学习计划见 [learn.md](./learn.md)；架构上下文见 [AGENTS.md](./AGENTS.md)；踩坑复盘见 [项目中遇到的问题.md](./项目中遇到的问题.md)；评测题见 [rag-eval.md](./rag-eval.md)。

## 环境要求

| 工具 | 建议版本 |
|------|----------|
| Node.js | `v24.15.0`（`client` engines 要求 `^22.18.0` 或 `>=24.12.0`） |
| pnpm | `11.x` |

## 技术栈（已确定）

| 层 | 选型 |
|----|------|
| 前端 | Vue 3 + Vite + TypeScript + Naive UI + UnoCSS |
| 后端 | Node.js + Express + TypeScript |
| 模型 API | DeepSeek（OpenAI 兼容协议 / 中转站） |
| Embedding | 本地 `@xenova/transformers`（默认 `Xenova/bge-small-zh-v1.5`） |
| RAG 短期存储 | `server/data/chunks.json` |
| 会话短期存储 | `server/data/conversations.json` |
| RAG 中期向量库 | pgvector（或托管库，尚未接入） |
| 包管理 | pnpm（workspace：`client` / `server`） |

## 项目目录

```text
learn-rag/
  client/                 # 前端：聊天 + 知识库管理
  server/                 # Express + DeepSeek + RAG + conversations
    src/
      routes/             # chat / rag / docs / models / conversations
      services/
      types/              # chat / chunk / conversation 公共类型
      utils/
    data/
      docs/               # 知识库 Markdown
      chunks.json         # 向量索引（gitignore）
      conversations.json  # 对话持久化（gitignore）
    scripts/              # build-index / test-*
  rag-eval.md
  项目中遇到的问题.md
  pnpm-workspace.yaml
  README.md
  learn.md
  AGENTS.md
```

## 安装

```bash
pnpm install
```

也可分别在 `client/`、`server/` 下执行 `pnpm install`。

## 如何配置 Key

后端通过 `server/.env` 读取配置（**不要提交真实 Key**）。

```bash
cp server/.env.example server/.env
```

示例：

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
| `DEEPSEEK_API_KEY` | 必填 |
| `DEEPSEEK_BASE_URL` | OpenAI 兼容接口根地址（到 `/v1`） |
| `DEEPSEEK_MODEL` | 聊天模型名 |
| `PORT` | 默认 `3000` |
| `EMBEDDING_MODEL` | 本地向量模型 |
| `HF_ENDPOINT` | Hugging Face 镜像（可选） |

改完 `.env` 后需**重启 server**。

## 启动 client + server

```bash
# 终端 1：后端
cd server
pnpm dev
# → http://localhost:3000 ；GET /health → ok

# 终端 2：前端
cd client
pnpm dev
# → http://localhost:1688
```

前端 Vite 代理：`/api` → `http://localhost:3000`。  
聊天页默认走 RAG 流式；知识库管理：`http://localhost:1688/docs`。

### 构建 RAG 索引

```bash
cd server
pnpm exec tsx scripts/build-index.ts
```

会生成 / 覆盖 `server/data/chunks.json`（gitignore，需本地构建）。也可在 `/docs` 页一键重建。

### 常用接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/rag/stream` | **主路径**：Hybrid 检索 + 引用 + SSE |
| POST | `/api/rag/reindex` | 重建 `chunks.json` |
| GET/POST/DELETE | `/api/rag/docs` | 文档列表 / 上传 / 删除 |
| GET | `/api/rag/docs/:name` | 读取文档内容 |
| POST | `/api/chat/stream` | 纯聊天 SSE |
| POST | `/api/chat/index` | 纯聊天非流式 |
| GET | `/api/models` | 可选模型列表 |
| GET | `/api/conversations/query` | 对话列表 |
| GET | `/api/conversations/get/:id` | 对话详情 |
| POST | `/api/conversations/create` | 新建对话 |
| POST | `/api/conversations/update/:id` | 更新对话 |
| POST | `/api/conversations/delete/:id` | 删除对话 |
| GET | `/health` | 健康检查 |

会话接口约定：**查询用 GET**（`query` / `get`），**操作用 POST**（`create` / `update` / `delete`）。命名用 conversation，不用 session。

## 架构与数据流

```text
Chat.vue
  → POST /api/rag/stream（fetchEventSource）
  → Vite proxy → Express
  → retrieve(Top-K=5) → MIN_SCORE 过滤 → 拼 RAG system
  → OpenAI SDK stream → DeepSeek / 中转站
  → SSE：{ content }* → { citations } → [DONE]
  → 前端正文 + 引用卡片（可预览文档）
  → POST /api/conversations/update/:id 落库
```

索引与检索：

```text
data/docs/*.md
  → chunk（#/## 为主，过长再 ### / 字数）
  → embed（本地 bge）→ chunks.json
提问：语义分 + 文件名/正文关键词加分 → Top-K → 阈值过滤
```

前端要点：

- 流式可停止；失败可重试上一句
- System Prompt：简洁 / 详细 / 翻译 / 结构化
- 左侧历史：新建 / 切换 / 删除，走 conversations API
- `/docs`：上传、删除、重建索引

## 学习进度（摘要）

| 阶段 | 状态 |
|------|------|
| 0 定位 | 完成 |
| 1 LLM 基础 | 完成 |
| 2 Week1 手写最小 RAG + 前端引用 | 完成 |
| 2 Week2 文档生命周期 + 管理页 | 完成（JSON，未上 pgvector） |
| 2 Week3 标题切分 + Hybrid + 拒答 + 评测 | 完成 |
| 2 Week4 会话持久化（conversations JSON） | **完成** |
| 3 Agent | 未开始 |

下一步可选：pgvector（向量 + 对话表）、权限、或进入阶段 3 Tool Calling。复盘见 `项目中遇到的问题.md`。

## 已知问题

- **无 pgvector**：索引与会话仍是本地 JSON，体量大时需自行评估性能。
- **语音输入遗留**：`Chat.vue` 中录音 / WebSocket 相关逻辑未完成。
- **部分网关“假成功”**：错误 Key 时偶发 200 空流；后端会尽量识别为空内容错误。
- **改 `.env` 需重启 server**；根目录暂无统一 `dev` 一键脚本。

## 暂不使用（当前阶段）

- Nuxt 作为主后端
- Hono
- 未进入阶段 3 前不上 LangChain / Multi-Agent
