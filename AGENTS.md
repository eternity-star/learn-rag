# learn-rag — AI 项目上下文

> 用途：后续在 Cursor 中提问时，优先参考本文了解仓库定位、目录、约定与当前实现状态。  
> 更新原则：架构或约定变更时同步改本文件。

---

## 1. 项目定位

- **仓库目标**：前端转 AI 应用工程师的学习与实践（LLM → RAG → Agent）。
- **当前阶段**：阶段 0–2 完成；**阶段 3 进行中**（手写 Tool Calling Agent：`ragSearch` + `listDocs`，含超时 / 最大轮次 / 失败回灌；前端主路径已切到 Agent SSE）。Week3+（人机确认、完整工具轨迹 UI）未齐；暂不上 LangChain / Multi-Agent 重框架。
- **主作品方向**：知识库问答（Web），Chat 走 DeepSeek（OpenAI 兼容 / 中转站）；Embedding 用本地 Transformers.js；检索由模型按需调工具，而非每轮强制 RAG。
- **学习路线**：见根目录 `learn.md`。踩坑复盘：`项目中遇到的问题.md`。评测题：`rag-eval.md`。

---

## 2. 仓库结构

```text
learn-rag/
├── AGENTS.md                 # 本文：给 AI / 协作者的架构上下文
├── README.md                 # 启动说明、技术栈、进度摘要
├── learn.md                  # 学习路线（阶段目标 / 验收）
├── rag-eval.md               # RAG 人工评测表（含失败案例）
├── 项目中遇到的问题.md        # 踩坑与优化复盘
├── pnpm-workspace.yaml       # client + server；allowBuilds（sharp / protobufjs 等）
├── package.json              # 根脚本：dev:client / dev:server / format
├── .prettierrc               # Prettier（保存格式化见 .vscode）
├── .gitignore                # 忽略 docs/、.env、chunks.json、conversations.json 等
├── .cursor/rules/            # Cursor 规则（自动注入）
├── .vscode/settings.json     # unocss.root=client；Prettier formatOnSave
├── docs/                     # 本地文档（已被 gitignore，不提交）
├── client/                   # 前端 Vue 3 + Vite + TS
│   ├── package.json
│   ├── vite.config.ts        # 端口 1688；proxy /api → :3000
│   ├── uno.config.ts         # UnoCSS，工具类前缀 lrx-
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       ├── router/           # / → AiChat；/docs → DocsHome
│       ├── views/ai-agent/   # 聊天（AiChat → ChatRecord + Chat；默认 Agent SSE）
│       ├── views/docs-home/  # 知识库管理（上传/删除/重建索引）
│       ├── services/         # http + api（chat / docs / conversations）
│       ├── constants/        # System Prompt 选项
│       ├── components/       # SiderTree、MarkdownView、DocPreviewModal 等
│       ├── styles/
│       ├── utils/
│       ├── types/            # ChatMessage、Conversation、RagCitation 等
│       └── stores/
└── server/                   # 后端 Express + TS
    ├── package.json
    ├── .env.example
    ├── scripts/              # build-index / test-chunk / test-embed / test-retrieve
    ├── data/
    │   ├── docs/             # 知识库 Markdown 源
    │   ├── chunks.json       # 向量索引（gitignore，需本地 build）
    │   └── conversations.json # 对话持久化（gitignore）
    └── src/
        ├── index.ts          # 注册 chat + rag + docs + models + conversations + agent
        ├── routes/
        │   ├── chat.ts
        │   ├── rag.ts        # 经典强制检索 RAG（仍可用）
        │   ├── docs.ts
        │   ├── conversations.ts
        │   ├── models.ts
        │   └── agent.ts      # Tool Calling Agent SSE（前端主路径）
        ├── services/
        │   ├── deepseek.ts
        │   ├── chunk.ts
        │   ├── embedding.ts
        │   ├── docs.ts
        │   ├── conversations.ts
        │   ├── indexer.ts
        │   └── agent.ts      # 工具循环：ragSearch / listDocs
        ├── types/            # chat / chunk / conversation（见 types/index.ts）
        └── utils/            # errors、sse、tool-calls
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
| SSE | `@microsoft/fetch-event-source` | 流式对话 / Agent /（备用）RAG |
| Markdown | markdown-it + `MarkdownView` | 消息与文档预览 |

**开发端口**：`1688`。**路径别名**：`@` → `client/src`。  
**代理**：`/api` → `http://localhost:3000`。

### 3.2 server

| 类别 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node + Express 5 + TypeScript | `tsx watch` 开发 |
| LLM | `openai` SDK | DeepSeek OpenAI 兼容 |
| Embedding | `@xenova/transformers` | 默认 `Xenova/bge-small-zh-v1.5`；可用 `HF_ENDPOINT` 镜像 |
| 索引 / 会话存储 | JSON 文件 | `chunks.json`、`conversations.json` |
| Agent | 手写 Tool Calling 循环 | 非 LangChain；工具：`ragSearch`、`listDocs` |

**包管理**：根目录 pnpm workspace（`client` / `server`）。根目录另有 Prettier（`pnpm format`）。

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

也可：`pnpm dev:server` / `pnpm dev:client`（在仓库根目录）。

环境变量见 `server/.env.example`（`DEEPSEEK_*`、`EMBEDDING_*`、`HF_ENDPOINT`）。

---

## 5. API 与数据流

### 5.1 路由约定（conversations）

- **查询类**：`GET` + 动作名（`query` / `get`）
- **操作类**：`POST` + 动作名（`create` / `update` / `delete`）
- 命名用 **conversation**（不用 session），便于以后迁 Postgres

### 5.2 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/stream` | **前端主路径**：Tool Calling Agent SSE；可选 body.`model` |
| POST | `/api/rag/stream` | 经典 RAG：强制 Hybrid retrieve → 拼 prompt → SSE（备用/对比） |
| POST | `/api/rag/reindex` | 重建 `data/chunks.json` |
| GET | `/api/rag/docs` | 文档列表 |
| GET | `/api/rag/docs/:name` | 读取文档内容 |
| POST | `/api/rag/docs` | 上传/保存文档（`name` + `content`） |
| DELETE | `/api/rag/docs/:name` | 删除文档 |
| POST | `/api/chat/stream` | 纯聊天 SSE（不检索、无工具） |
| POST | `/api/chat/index` | 纯聊天非流式 |
| GET | `/api/models` | 可选模型列表 |
| GET | `/api/conversations/query` | 对话列表（无 messages） |
| GET | `/api/conversations/get/:id` | 对话详情（含 messages） |
| POST | `/api/conversations/create` | 新建对话 |
| POST | `/api/conversations/update/:id` | 更新 title / messages |
| POST | `/api/conversations/delete/:id` | 删除对话 |
| GET | `/health` | 健康检查 |

### 5.3 主路径：Agent（当前前端默认）

```text
Chat.vue
  → POST /api/agent/stream
  → agentStream：模型可 tool_choice=auto
      → ragSearch(query)  → retrieve(Top-K=5) → 回灌 tool 结果
      → listDocs()        → 文档概况（总数 + 按大小前 10）
  → 约束：MAX_TOOL_ROUNDS=3；单工具超时 20s；失败回灌文案降级；超轮次强制无工具收尾
  → SSE: { event: tool_start|tool_end|tool_error|tool_limit }*
       → { content }* → { citations }? → [DONE]
  → 前端：isRetrieving「正在检索知识库…」+ 引用卡片；结束后 conversations/update
```

工具列表（`server/src/services/agent.ts`）：

| 工具 | 作用 |
|------|------|
| `ragSearch` | 本地知识库 Hybrid 检索，返回片段文本 + hits（citations） |
| `listDocs` | 列出知识库文档概况（不代替正文检索） |

说明：Agent 的 `ragSearch` **不过**经典 RAG 的 `MIN_SCORE(0.45)` 拒答阈值；经典路径的「禁止瞎编价格/官网」system 拼装也不自动带上——两套策略尚未统一。

### 5.4 备用路径：经典 RAG

```text
POST /api/rag/stream
  → retrieve(question, topK=5)
  → 过滤 score < MIN_SCORE(0.45) → 无命中则拒答约束
  → 否则把片段写入 system「参考资料」
  → chatCompletionStream → SSE: { content }* → { citations } → [DONE]
```

索引与检索（Agent / RAG 共用）：

```text
data/docs/*.md
  → chunkText（#/## 为主；过长再 ### 或字数窗口）
  → embedText（去图片 URL 噪声）→ Indexer.save(chunks.json)
提问时：
  语义点积 + 文件名加分 + 正文关键词加分 → Top-K
```

### 5.5 前端聊天模块

```text
AiChat.vue
├── SiderTree
│   ├── #left-content  → ChatRecord（conversations API）
│   └── #right-content → Chat（默认 Agent SSE + 结束后 update）
```

| 文件 | 职责 |
|------|------|
| `Chat.vue` | **默认** `/api/agent/stream`；tool 事件 → 检索态；citations；停止/重试；模型选择；结束后持久化 |
| `ChatRecord.vue` | 新建 / 列表 / 删除 / 切换 |
| `conversations-api.ts` | 对话 CRUD 封装 |
| `server/.../conversations.ts` | 读写 `data/conversations.json` |
| `types/chat.d.ts` | `ChatMessage`（含 `isRetrieving`）、`Conversation`、`RagCitation` 等 |
| `constants/system-prompt.ts` | 简洁 / 详细 / 翻译 / 结构化 |

流式：`fetchEventSource` + `AbortController`；Agent 路径可能先出现 `tool_*` 再正文 / `citations`。

### 5.6 server 公共类型

| 文件 | 内容 |
|------|------|
| `types/chat.ts` | `ChatRole`、`ChatMessage`、`LlmModelItem` |
| `types/chunk.ts` | `Chunk`、`IndexedChunk`、`RetrieveHit`（=`Citation`） |
| `types/conversation.ts` | `ConversationMessage` = `ChatMessage` & 扩展；`Conversation` / `Summary` |
| `types/index.ts` | barrel 导出 |

引用与检索命中同形：`citations?: RetrieveHit[]`，勿再复制一套 Citation 字段。

---

## 6. 可复用组件（`src/components`）

| 组件 | 路径 | 说明 |
|------|------|------|
| `SiderTree` | `components/sider-tree` | 左右分栏 + 拖拽改宽 |
| `MarkdownView` | `components/markdown-view` | Markdown 渲染 |
| `DocPreviewModal` | `components/doc-preview-modal` | 引用跳转预览文档 |
| `WangEditor` | `components/wangeditor` | wangEditor 封装 |

导出：`src/components/index.ts`。

---

## 7. 样式与 UnoCSS 约定

- 配置：`client/uno.config.ts`，`presetUno({ prefix: 'lrx-' })`
- 入口：`src/styles/index.ts` 必须 `import 'uno.css'`
- IDE：根 `.vscode/settings.json` 中 `"unocss.root": "client"`；Prettier 为默认格式化器 + `formatOnSave`
- 类名示例：`lrx-w-full`、`lrx-p-0`、`!lrx-p-0`
- 组件样式优先 `lang="less" scoped`

---

## 8. 编码约定（给 AI 改代码时遵守）

1. Vue：Composition API + `<script setup lang="ts">`；顺序 template → script → style。
2. UI：优先 Naive UI；消息/对话框用已注入的 `useMessage` / `useDialog`。
3. 图标：`import Xxx from '~icons/ant-design/xxx'`，再交给 `n-icon`。
4. **非流式 API**：在 `client/src/services/api/*` 统一 `import { http } from '../http'`，用 `http.request`；`baseURL` 已是 `/api`，url 写 `/conversations/query` 这类路径。未特别说明时不要在 api 层直接 `fetch`。
5. **流式**：POST SSE 用 `fetchEventSource`，不要用原生 `EventSource`，也不走 `http.request`。聊天主路径默认 `/api/agent/stream`。
6. 新能力走 `/api/*`（经 Vite 代理）；不要再把主路径接回 `/process/ai/*`。
7. 业务改动优先动 `server/src/services/*`；路由保持薄。公共类型放 `server/src/types/`。Agent 工具协议增量解析见 `utils/tool-calls.ts`。
8. 少加无关文档；`docs/`、`chunks.json`、`conversations.json`、`.env` 默认不提交。
9. 用户侧沟通用简体中文。

---

## 9. 学习进度（对照 learn.md）

| 阶段 | 状态 | 说明 |
|------|------|------|
| 0 定位 | 完成 | — |
| 1 LLM 基础 | 完成 | 流式 Chat、停止、重试、system、结构化输出 |
| 2 Week1 手写 RAG | 完成 | 索引 → 检索 → 引用流式回答 |
| 2 Week2 文档生命周期 | 完成 | docs API + `/docs` 管理页；存储仍为 JSON |
| 2 Week3 检索质量 | 完成 | 标题切分、Hybrid、拒答、评测与复盘 |
| 2 Week4 会话 | **JSON 版完成** | conversations API + 左右栏打通；pg/权限仍可选 |
| 3 Agent Week1–2 | **基本完成** | 双工具、超时、最大轮次、失败降级；前端主路径已切 Agent |
| 3 Agent Week3+ | 未齐 | 高风险确认、完整工具轨迹 UI、`tool_limit` 专项处理等 |

---

## 10. 已知缺口 / 后续方向

- [x] Express + DeepSeek SSE + Vite `/api` 代理
- [x] 手写 RAG：chunk / embed / JSON 索引 / Hybrid retrieve
- [x] `/api/rag/stream` + 前端 citations + DocPreviewModal
- [x] 文档上传 / 重建索引 / 删除 + `docs-home`
- [x] 评测表与失败案例（`rag-eval.md`、`项目中遇到的问题.md`）
- [x] 对话持久化：`/api/conversations/*` + `conversations.json` + 左右栏打通
- [x] Agent 主路径：`/api/agent/stream` + `ragSearch` / `listDocs` + 工具超时 / 最大轮次
- [ ] 统一经典 RAG 与 Agent 的拒答 / 防瞎编策略（`MIN_SCORE`、system 约束）
- [ ] Agent UI：完整工具轨迹；处理 `tool_limit`；可选独立 `agent-api` 封装
- [ ] 高风险操作人机确认（或文档明确说明为何不需要）
- [ ] 中期向量库（pgvector 等）；对话表也可一并迁库
- [ ] Rerank（可选了解）
- [ ] 清理 `Chat.vue` 语音/WebSocket 遗留

---

## 11. 提问时建议引用的文件

| 问题类型 | 优先打开 / @ 的文件 |
|----------|---------------------|
| 整体架构 / 约定 | `AGENTS.md`、`README.md` |
| 学习进度 / 验收 | `learn.md` |
| 踩坑 / 优化复盘 | `项目中遇到的问题.md` |
| 评测题 | `rag-eval.md` |
| **Agent 工具循环** | `server/src/services/agent.ts`、`routes/agent.ts`、`utils/tool-calls.ts` |
| RAG 路由（经典） | `server/src/routes/rag.ts` |
| 索引 / 检索 | `server/src/services/indexer.ts`、`chunk.ts`、`embedding.ts` |
| 文档 CRUD | `server/src/routes/docs.ts`、`services/docs.ts`；前端 `views/docs-home/` |
| 对话持久化 | `server/src/routes/conversations.ts`、`services/conversations.ts`；前端 `ChatRecord.vue`、`conversations-api.ts` |
| 公共类型 | `server/src/types/` |
| SSE / 引用事件 | `server/src/utils/sse.ts` |
| 纯聊天 | `server/src/routes/chat.ts`、`services/deepseek.ts` |
| 聊天 UI / Agent 流式 / 引用 | `client/src/views/ai-agent/components/Chat.vue` |
| 消息类型 | `client/src/types/chat.d.ts` |
| 构建 / 代理 | `client/vite.config.ts` |
