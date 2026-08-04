# learn-rag — AI 项目上下文

> 用途：后续在 Cursor 中提问时，优先参考本文了解仓库定位、目录、约定与当前实现状态。  
> 更新原则：架构或约定变更时同步改本文件。

---

## 1. 项目定位

- **仓库目标**：前端转 AI 应用工程师的学习与实践（LLM → RAG → Agent）。
- **当前阶段**：阶段 0–1 完成；**阶段 2 Week1 手写最小 RAG 主闭环已跑通**（索引 → 检索 → 带引用流式回答）。下一步偏 Week2/质量与评测（上传、pgvector、评测表），暂不上 Agent 重框架。
- **主作品方向**：知识库问答（Web），模型默认 DeepSeek（OpenAI 兼容协议）。
- **学习路线**：见根目录 `learn.md`（分阶段路径，非运行时代码）。

---

## 2. 仓库结构

```text
learn-rag/
├── AGENTS.md                 # 本文：给 AI / 协作者的架构上下文
├── README.md                 # 启动说明、技术栈、进度摘要
├── learn.md                  # 学习路线（阶段目标 / 验收）
├── pnpm-workspace.yaml       # client + server
├── .gitignore                # 忽略 docs/、.env、server/data/chunks.json 等
├── .cursor/rules/            # Cursor 规则（自动注入）
├── .vscode/settings.json     # 含 unocss.root=client
├── docs/                     # 本地文档（已被 gitignore，不提交）
├── client/                   # 前端 Vue 3 + Vite + TS
│   ├── package.json
│   ├── vite.config.ts        # 端口 1688；proxy /api → :3000
│   ├── uno.config.ts         # UnoCSS，工具类前缀 lrx-
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── router/           # / → AiChat；/docs → DocsHome
│       ├── views/ai-agent/   # 聊天业务页
│       ├── views/docs-home/  # 知识库管理（上传/删除/重建索引）
│       ├── services/         # HTTP / API（chat-api、docs-api）
│       ├── constants/        # System Prompt 选项
│       ├── components/
│       ├── styles/
│       ├── utils/
│       ├── types/            # ChatMessage、RagCitation 等
│       └── stores/
└── server/                   # 后端 Express + TS
    ├── package.json
    ├── .env.example
    ├── scripts/              # build-index / test-chunk / test-embed / test-retrieve
    ├── data/
    │   ├── docs/             # 知识库 Markdown 源
    │   └── chunks.json       # 构建产物（gitignore，需本地 build）
    └── src/
        ├── index.ts          # 注册 chat + rag + models 路由，/health
        ├── routes/
        │   ├── chat.ts       # /api/chat/index、/api/chat/stream
        │   ├── rag.ts        # /api/rag/stream、/api/rag/reindex
        │   ├── docs.ts       # /api/rag/docs 列表/上传/删除
        │   └── models.ts     # /api/models 可选模型列表
        ├── services/
        │   ├── deepseek.ts   # OpenAI SDK → DeepSeek（含 listModels）
        │   ├── chunk.ts      # 固定字数切分 + overlap
        │   ├── embedding.ts  # 本地 Transformers.js
        │   ├── docs.ts       # 知识库源文件读写（与 Indexer 解耦）
        │   └── indexer.ts    # build / save / load / retrieve
        ├── types/chunk.ts
        └── utils/            # errors、sse（含 writeSseCitations）
```

---

## 3. 技术栈

### 3.1 client

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3 + Vite 8 + TypeScript | `<script setup lang="ts">` |
| 路由 / 状态 | vue-router 5、pinia 3 | 业务状态多在页面/组件内 |
| UI | naive-ui | 自动按需 + Provider 已在 App 挂好 |
| 样式 | UnoCSS + less | Uno 前缀 **`lrx-`** |
| SSE | `@microsoft/fetch-event-source` | 流式对话 / RAG |
| 富文本 | `@wangeditor/editor` | Markdown 预览等 |

**开发端口**：`1688`。**路径别名**：`@` → `client/src`。  
**代理**：`/api` → `http://localhost:3000`。

### 3.2 server

| 类别 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node + Express 5 + TypeScript | `tsx watch` 开发 |
| LLM | `openai` SDK | DeepSeek OpenAI 兼容 |
| Embedding | `@xenova/transformers` | 默认 `Xenova/bge-small-zh-v1.5` |
| 索引存储 | JSON 文件 | `data/chunks.json` |

**包管理**：根目录 pnpm workspace（`client` / `server`）。

---

## 4. 启动

```bash
# 根目录
pnpm install

# 终端 1
cd server && pnpm dev          # :3000

# 终端 2
cd client && pnpm dev          # :1688

# 首次 / 更新 docs 后构建索引
cd server && pnpm exec tsx scripts/build-index.ts
```

环境变量见 `server/.env.example`（`DEEPSEEK_*`、`EMBEDDING_*`、`HF_ENDPOINT`）。

---

## 5. API 与数据流

### 5.1 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/rag/stream` | **当前前端主路径**：retrieve → 拼 prompt → SSE；先发 `content`*，收尾再发 `citations` → `[DONE]`；可选 body.`model` |
| POST | `/api/chat/stream` | 纯聊天 SSE（不检索）；可选 body.`model` |
| POST | `/api/chat/index` | 纯聊天非流式；可选 body.`model` |
| GET | `/api/models` | 可选模型列表（封装上游 `{DEEPSEEK_BASE_URL}/models`） |
| GET | `/health` | 健康检查 |

### 5.2 RAG 主路径

```text
Chat.vue
  → POST /api/rag/stream
  → retrieve(question, topK=3)
  → 若 topScore < MIN_SCORE(0.35) → 空引用 + 拒答约束
  → 否则把 Top-K 片段写入 system「参考资料」
  → chatCompletionStream(DeepSeek)
  → SSE: { content }* → { citations } → [DONE]
  → 前端气泡展示引用卡片（source / text / score）
```

索引：

```text
data/docs/*.md → chunkText → embedText → Indexer.save(chunks.json)
提问时 Indexer.load → 问题向量 × chunk 向量点积排序 → Top-K
```

### 5.3 前端聊天模块

```text
AiChat.vue
├── SiderTree
│   ├── #left-content  → ChatRecord（历史；仍偏旧 /process 接口）
│   └── #right-content → Chat（消息 + 输入 + RAG SSE + 引用）
```

| 文件 | 职责 |
|------|------|
| `Chat.vue` | 发消息、调 `/api/rag/stream`、模型选择、解析 citations、停止/重试 |
| `ChatRecord.vue` | 历史列表（未完全接到新后端） |
| `types/chat.d.ts` | `ChatMessage`、`RagCitation`、`SystemPromptKey`、`LlmModelItem` |
| `constants/system-prompt.ts` | 简洁 / 详细 / 翻译 / 结构化 |

流式要点：`fetchEventSource` + `AbortController`；SSE 事件里可能先出现 `citations` 数组。

---

## 6. 可复用组件（`src/components`）

| 组件 | 路径 | 说明 |
|------|------|------|
| `SiderTree` | `components/sider-tree` | 左右分栏 + 拖拽改宽 |
| `WangEditor` | `components/wangeditor` | wangEditor 封装，`v-model:value` |

导出：`src/components/index.ts`。

---

## 7. 样式与 UnoCSS 约定

- 配置：`client/uno.config.ts`，`presetUno({ prefix: 'lrx-' })`
- 入口：`src/styles/index.ts` 必须 `import 'uno.css'`
- IDE：根 `.vscode/settings.json` 中 `"unocss.root": "client"`
- 类名示例：`lrx-w-full`、`lrx-p-0`、`!lrx-p-0`
- 组件样式优先 `lang="less" scoped`

---

## 8. 编码约定（给 AI 改代码时遵守）

1. Vue：Composition API + `<script setup lang="ts">`；顺序 template → script → style。
2. UI：优先 Naive UI；消息/对话框用已注入的 `useMessage` / `useDialog`。
3. 图标：`import Xxx from '~icons/ant-design/xxx'`，再交给 `n-icon`。
4. **非流式 API**：在 `client/src/services/api/*` 统一 `import { http } from '../http'`，用 `http.request`；`baseURL` 已是 `/api`，url 写 `/rag/docs` 这类路径。未特别说明时不要在 api 层直接 `fetch`。
5. **流式**：POST SSE 用 `fetchEventSource`，不要用原生 `EventSource`，也不走 `http.request`。
6. 新聊天/RAG 能力走 `/api/*`（经 Vite 代理）；不要再把主路径接回 `/process/ai/*`。
7. RAG 改动优先动 `server/src/services/*` 与 `routes/rag.ts` / `docs.ts`；保持路由薄、逻辑在 services。
8. 少加无关文档；`docs/` 默认不提交；`chunks.json` 不提交（本地 build）。
9. 用户侧沟通用简体中文。

---

## 9. 已知缺口 / 后续方向

- [x] `server/` Express + DeepSeek SSE
- [x] Vite 代理 `/api` → 后端
- [x] 手写 RAG：chunk / embed / JSON 索引 / retrieve
- [x] `/api/rag/stream` + 前端 citations 展示
- [ ] 简易评测表（20 问）与失败案例记录
- [x] 文档上传 / 重建索引 / 删除的 HTTP API + `docs-home` 管理页
- [ ] 中期向量库（pgvector 等）
- [ ] 切分优化（标题层级）、Hybrid / Rerank（了解即可）
- [ ] `AiChat` 左右栏会话与新后端打通
- [ ] 清理 `Chat.vue` 语音/WebSocket 遗留
- [ ] Agent / Tool Calling（阶段 3，RAG 评测与工程化后再做）

---

## 10. 提问时建议引用的文件

| 问题类型 | 优先打开 / @ 的文件 |
|----------|---------------------|
| 整体架构 / 约定 | `AGENTS.md`、`README.md` |
| 学习进度 / 验收 | `learn.md` |
| RAG 路由 | `server/src/routes/rag.ts` |
| 索引 / 检索 | `server/src/services/indexer.ts`、`chunk.ts`、`embedding.ts` |
| SSE / 引用事件 | `server/src/utils/sse.ts` |
| 纯聊天 | `server/src/routes/chat.ts`、`services/deepseek.ts` |
| 聊天 UI / 流式 / 引用 | `client/src/views/ai-agent/components/Chat.vue` |
| 消息类型 | `client/src/types/chat.d.ts` |
| 历史列表 | `client/src/views/ai-agent/components/ChatRecord.vue` |
| 构建 / 代理 | `client/vite.config.ts` |
