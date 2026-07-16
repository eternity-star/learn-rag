# learn-rag — AI 项目上下文

> 用途：后续在 Cursor 中提问时，优先参考本文了解仓库定位、目录、约定与当前实现状态。  
> 更新原则：架构或约定变更时同步改本文件。

---

## 1. 项目定位

- **仓库目标**：前端转 AI 应用工程师的学习与实践（LLM → RAG → Agent）。
- **当前阶段**：前端 AI 聊天壳已落地；后端 `server/` 规划中但仓库内尚未初始化。
- **主作品方向**：知识库问答（Web），模型默认 DeepSeek（OpenAI 兼容协议）。
- **学习路线**：见根目录 `learn.md`（分阶段路径，非运行时代码）。

---

## 2. 仓库结构

```text
learn-rag/
├── AGENTS.md                 # 本文：给 AI / 协作者的架构上下文
├── README.md                 # 技术栈与目录约定
├── learn.md                  # 学习路线（阶段目标 / 验收）
├── .gitignore                # 当前忽略整个 docs/
├── .cursor/rules/            # Cursor 规则（自动注入）
├── .vscode/settings.json     # 含 unocss.root=client
├── docs/                     # 本地文档（已被 gitignore，不提交）
│   └── 前端项目初始化文档.md
└── client/                   # 前端应用（当前唯一可运行包）
    ├── package.json          # pnpm
    ├── vite.config.ts
    ├── uno.config.ts         # UnoCSS，工具类前缀 lrx-
    └── src/
        ├── main.ts
        ├── App.vue           # Naive UI Provider + 主题覆盖
        ├── router/           # 目前仅 / → AiChat
        ├── views/ai-agent/   # AI 聊天业务页
        ├── components/       # 可复用业务组件（barrel 导出）
        ├── styles/           # uno.css + global.less
        ├── utils/            # color / obj 等
        ├── types/            # 全局类型
        └── stores/           # Pinia（脚手架计数器，业务未用）
```

规划中（README 已写、代码未建）：

```text
server/                 # Node.js + Express + TypeScript
pnpm-workspace.yaml     # client + server workspace
```

---

## 3. 技术栈（client）

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3 + Vite 8 + TypeScript | `<script setup lang="ts">` |
| 路由 / 状态 | vue-router 5、pinia 3 | 业务状态多在页面/组件内 |
| UI | naive-ui | 自动按需 + Provider 已在 App 挂好 |
| 主题色辅助 | seemly | `changeColor` / `composite` |
| 样式 | UnoCSS + less | Uno 前缀 **`lrx-`**；组件内 `lang="less" scoped` |
| 工程化 | unplugin-auto-import、unplugin-vue-components、unplugin-icons | Vue API / Naive 组件 / 图标自动导入 |
| 图标 | `~icons/ant-design/*` | 需 `@iconify-json/ant-design` |
| SSE | `@microsoft/fetch-event-source` | AI 流式对话 |
| 富文本 | `@wangeditor/editor` + `editor-for-vue` | Markdown 预览等 |
| 图片预览 | v-viewer + viewerjs | 指令 `v-viewer` |
| 工具 | lodash-es | |

**包管理**：pnpm（在 `client/` 下执行脚本）。  
**开发端口**：`1688`（`vite.config.ts`）。  
**路径别名**：`@` → `client/src`。

---

## 4. 前端启动与入口

```bash
cd client
pnpm install
pnpm dev      # http://localhost:1688
pnpm build
```

启动链：

1. `main.ts`：引入 `styles`（含 `uno.css`）→ 注册 `v-viewer`、Pinia、Router → `mount`
2. `App.vue`：`n-config-provider` + message/dialog/modal/notification providers → `<router-view />`
3. 路由 `/` → `views/ai-agent/AiChat.vue`

---

## 5. AI 聊天模块（当前核心业务）

### 5.1 页面组成

```text
AiChat.vue
├── SiderTree（左右分栏可拖拽）
│   ├── #left-content  → ChatRecord（历史会话列表）
│   └── #right-content → Chat（消息列表 + 输入 + 流式）
```

| 文件 | 职责 |
|------|------|
| `AiChat.vue` | 布局编排；预留 `changeChat` / `changeChatInfo` 联动 |
| `ChatRecord.vue` | 新建/删除/列表/拉取会话详情；向父 emit |
| `Chat.vue` | 发消息、SSE 流式渲染、提示词、语音相关（部分遗留） |
| `interface.ts` | `ChatRecord` 类型（偏本地模型，与接口字段可能未完全对齐） |

### 5.2 组件通信

- `ChatRecord` → `AiChat`：`changeChat`、`changeChatInfo`
- `AiChat` → `Chat`：目前主要 `:is-page="true"`；历史回填联动仍为 TODO

### 5.3 接口约定（代理前缀 `/process`）

| 用途 | 方法 | 路径 | 调用位置 |
|------|------|------|----------|
| 流式聊天（独立页） | POST SSE | `/process/ai/autoQuestionAiChat` | `Chat.vue` |
| 流式聊天（业务对象） | POST SSE | `/process/ai/chatAi` | `Chat.vue` |
| 历史列表 | POST | `/process/ai/chatAiHistory` | `ChatRecord.vue` |
| 会话详情 | POST | `/process/ai/queryChatInfo` | `ChatRecord.vue` |
| 删除历史 | POST | `/process/ai/deleteHistory` | `ChatRecord.vue` |

流式实现要点（`Chat.vue`）：

- 使用 `fetchEventSource`，`AbortController` 可中止
- `isStream`：`1` 文本流式，`0` JSON（等齐再展示）
- 路由 query 可配：`parseFormat`、`aiType`、`isOnlyPage`、`isStream` 等

> 注意：仓库内尚无 Vite `server.proxy` 配置；`/process` 需后端或网关，本地可能需自行补代理。

---

## 6. 可复用组件（`src/components`）

| 组件 | 路径 | 说明 |
|------|------|------|
| `SiderTree` | `components/sider-tree` | 左右分栏 + 拖拽改宽；默认根节点有 padding，外层可用 `!lrx-p-0` 覆盖 |
| `WangEditor` | `components/wangeditor` | wangEditor 封装，`v-model:value` |

导出：`src/components/index.ts` → `import { SiderTree, WangEditor } from '@/components'`。

---

## 7. 样式与 UnoCSS 约定

- 配置：`client/uno.config.ts`，`presetUno({ prefix: 'lrx-' })`
- 入口：`src/styles/index.ts` 必须 `import 'uno.css'`
- IDE：根 `.vscode/settings.json` 中 `"unocss.root": "client"`；扩展 `antfu.unocss`
- 类名示例：`lrx-w-full`、`lrx-p-0`、`!lrx-p-0`（important）
- **不要**写 `lrx-padding-0` / `ml10` 这类非标准类（不会生成样式）
- 组件样式优先 `lang="less" scoped`；全局工具类用 Uno

主题：`App.vue` 用 seemly 从 `primaryColor` 派生 hover / pressed / active。

---

## 8. 编码约定（给 AI 改代码时遵守）

1. Vue：Composition API + `<script setup lang="ts">`；顺序 template → script → style。
2. UI：优先 Naive UI；消息/对话框用已注入的 `useMessage` / `useDialog`（auto-import）。
3. 图标：`import Xxx from '~icons/ant-design/xxx'`，再交给 `n-icon`。
4. 流式：POST 场景用 `fetchEventSource`，不要用原生 `EventSource`。
5. 非流式 JSON：可用 `fetch`；历史接口当前多为 `fetch` + `res.json()`。
6. 少加无关文档；业务文档若在 `docs/` 默认不提交（见根 `.gitignore`）。
7. 回复与注释：用户侧沟通用简体中文。

---

## 9. 已知缺口 / 后续方向

- [ ] `server/` Express + DeepSeek 代理与真实 SSE
- [ ] Vite 代理 `/process` → 后端
- [ ] `AiChat` 左右栏会话切换与消息回填打通
- [ ] Pinia 承载会话/消息（可选）
- [ ] RAG：短期 JSON/内存 → 中期 pgvector（见 README / learn.md）
- [ ] 清理 `Chat.vue` 中语音/WebSocket 等遗留未完成逻辑

---

## 10. 提问时建议引用的文件

| 问题类型 | 优先打开 / @ 的文件 |
|----------|---------------------|
| 整体架构 / 约定 | `AGENTS.md`、`README.md` |
| 聊天 UI / 流式 | `client/src/views/ai-agent/components/Chat.vue` |
| 历史列表 | `client/src/views/ai-agent/components/ChatRecord.vue` |
| 布局页 | `client/src/views/ai-agent/AiChat.vue` |
| 主题 | `client/src/App.vue`、`client/src/utils/color.ts` |
| 构建 / 插件 | `client/vite.config.ts`、`client/uno.config.ts` |
| 学习计划 | `learn.md` |
| 脚手架步骤（本地） | `docs/前端项目初始化文档.md`（不提交） |
