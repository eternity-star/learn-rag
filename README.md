# learn-rag

前端转 AI 应用工程师的学习与实践仓库（LLM → RAG → Agent）。

当前已跑通：

- **阶段 1**：Vue 聊天壳 + Express SSE 代理 DeepSeek（OpenAI 兼容）；停止生成 / 重试 / System Prompt / 结构化输出练习
- **阶段 2 Week1～3（主线）**：手写 RAG 闭环 + 文档生命周期 + 检索质量迭代
  - Markdown 标题切分 → 本地 Embedding → `chunks.json`
  - 简易 Hybrid 检索（向量 + 正文/文件名关键词）→ 低分拒答 → 带引用流式回答
  - 知识库管理页（上传 / 删除 / 重建索引）+ 人工评测表与问题复盘

学习计划见 [learn.md](./learn.md)；架构上下文见 [AGENTS.md](./AGENTS.md)；踩坑复盘见 [项目中遇到的问题.md](./项目中遇到的问题.md)；评测题见 [rag-eval.md](./rag-eval.md)。

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
  client/                 # 前端：聊天 + 知识库管理页
  server/                 # Express + DeepSeek + RAG
    src/
      routes/             # chat / rag / docs / models
      services/           # deepseek、chunk、embedding、indexer、docs
      utils/              # errors、SSE（含 citations）
    data/
      docs/               # 知识库 Markdown 源文件
      chunks.json         # 向量索引（gitignore，需本地构建）
    scripts/              # build-index / test-*
  rag-eval.md             # RAG 人工评测表
  项目中遇到的问题.md      # 踩坑与优化复盘
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
| POST | `/api/rag/stream` | **主路径**：Hybrid 检索 + 引用 + SSE |
| POST | `/api/rag/reindex` | 重建 `chunks.json` |
| GET/POST/DELETE | `/api/rag/docs` | 文档列表 / 上传 / 删除 |
| POST | `/api/chat/stream` | 纯聊天 SSE（不检索） |
| POST | `/api/chat/index` | 纯聊天非流式 |
| GET | `/api/models` | 可选模型列表 |
| GET | `/health` | 健康检查 |

也可在前端 `http://localhost:1688/docs` 管理知识库并一键重建索引。

## 架构与数据流

当前主路径（知识库问答）：

```text
Chat.vue
  → POST /api/rag/stream（fetchEventSource）
  → Vite proxy → Express /api/rag/stream
  → retrieve(Top-K=5) → MIN_SCORE 过滤 → 拼 RAG system（低分/无命中则拒答）
  → OpenAI SDK（stream:true）→ DeepSeek / 中转站
  → SSE：{ content }* → { citations } → [DONE]
  → 前端展示正文 + 引用卡片
```

索引与检索：

```text
data/docs/*.md
  → chunk（Markdown #/## 为主，过长再按 ### / 字数）
  → embed（本地 bge；入库前去图片 URL 噪声）
  → chunks.json
提问时：
  语义分（点积）+ 文件名加分 + 正文关键词加分 → Top-K → 阈值过滤
```

前端要点：

- 流式：`fetchEventSource` + `AbortController`（可停止生成）
- 失败可一键重试上一句
- 可选 System Prompt：简洁 / 详细 / 翻译 / 结构化
- RAG 引用：`source` / 片段 / `score`
- `/docs`：上传、删除、重建索引

后端要点：

- 先读流第一块再写 SSE 头，尽量让鉴权错误以非 200 JSON 返回
- `MIN_SCORE ≈ 0.45`；资料不足或未写明价格/官网/下载地址时禁止编造
- 空流 / 流内 `error` 转为明确错误文案

## 学习进度（摘要）

| 阶段 | 状态 |
|------|------|
| 0 定位 | 完成 |
| 1 LLM 基础（流式 Chat / 停止 / 重试 / system / 结构化） | 完成 |
| 2 Week1 手写最小 RAG + 前端引用 | 完成 |
| 2 Week2 文档上传 / 删除 / 重建索引 + 管理页 | 完成（仍用 JSON，未上 pgvector） |
| 2 Week3 标题切分 + Hybrid + 拒答 + 评测表 | **基本完成**（见 `rag-eval.md`） |
| 2 Week4+ 会话持久化 / 权限 / pgvector | 未开始 |
| 3 Agent | 未开始 |

下一步建议：引用点击跳转文档、会话与新后端打通，或评估是否上 pgvector。复盘见 `项目中遇到的问题.md`。

## 已知问题

- **历史会话未接新后端**：`ChatRecord` 仍偏向旧 `/process/ai/*`；左右栏切换与消息回填未完全打通。
- **无 pgvector**：索引仍是本地 `chunks.json`，体量大时需自行评估性能。
- **引用跳转未做**：citations 可展示，尚未一键打开 `/docs` 对应文件定位。
- **语音输入遗留**：`Chat.vue` 中录音 / WebSocket 相关逻辑未完成。
- **部分网关“假成功”**：错误 Key 时偶发 200 空流；后端会尽量识别为空内容错误。
- **改 `.env` 需重启 server**；根目录暂无统一 `dev` 一键脚本。

## 暂不使用（当前阶段）

- Nuxt 作为主后端
- Hono
- 未进入阶段 3 前不上 LangChain / Multi-Agent
