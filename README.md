# learn-rag

前端转 AI 应用工程师的学习与实践仓库。

## 技术栈（已确定）

| 层 | 选型 |
|----|------|
| 前端 | Vue 3 + Vite + TypeScript |
| 后端 | Node.js + Express + TypeScript |
| 模型 API | DeepSeek（OpenAI 兼容协议） |
| RAG 短期存储 | JSON / 内存（手写最小 RAG） |
| RAG 中期向量库 | pgvector（或托管向量库，二选一） |
| 包管理 | pnpm（workspace：`client` / `server`） |

## 项目目录（已确定）

```text
learn-rag/
  client/                 # 前端：Vue 3 + Vite + TypeScript
  server/                 # 后端：Node.js + Express + TypeScript
  pnpm-workspace.yaml     # packages: client, server
  package.json            # 可选：根 scripts
  README.md
  learn.md
```

- 单仓库、双目录；依赖统一用 **pnpm** 管理
- 前端只在 `client/` 初始化；后端只在 `server/` 初始化

## 暂不使用（当前阶段）

- Nuxt 作为主后端
- Hono
- 未手写通 RAG 前不上 LangChain / Multi-Agent

## 学习计划

详见 [learn.md](./learn.md)。
