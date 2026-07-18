# client

learn-rag 前端应用：Vue 3 + Vite + TypeScript + Naive UI。

## 环境要求

当前开发环境：

| 工具 | 版本 |
|------|------|
| Node.js | v24.15.0 |
| pnpm | 11.1.1 |

`package.json` 中 Node engines 约定为：`^22.18.0 || >=24.12.0`。请尽量对齐上表版本，避免依赖解析或构建差异。

## 推荐 IDE

[VS Code](https://code.visualstudio.com/) / Cursor + [Vue (Official) / Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)（请禁用 Vetur）。

## 推荐浏览器

- Chromium 系（Chrome、Edge、Brave 等）：
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [开启 Chrome DevTools Custom Object Formatter](http://bit.ly/object-formatters)
- Firefox：
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [开启 Firefox DevTools Custom Object Formatter](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## `.vue` 的 TypeScript 支持

TypeScript 默认无法处理 `.vue` 的类型信息，因此类型检查使用 `vue-tsc`，而不是直接用 `tsc`。编辑器侧需安装 Volar，才能让 TS 语言服务识别 `.vue` 类型。

## 配置说明

详见 [Vite 配置文档](https://vite.dev/config/)。

## 项目启动

```sh
pnpm install
```

### 开发（热更新）

```sh
pnpm dev
```

开发服务默认端口：`1688`（见 `vite.config.ts`）。

### 生产构建（类型检查 + 打包）

```sh
pnpm build
```
