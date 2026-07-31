<template>
  <div class="markdown-body" v-html="html" v-viewer></div>
</template>

<script setup lang="ts">
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{
  content?: string | null;
  /** 本地可信文档可开；聊天默认关闭更安全 */
  allowHtml?: boolean;
}>();

const html = computed(() =>
  renderMarkdown(props.content || '', { allowHtml: props.allowHtml }),
);
</script>

<style lang="less" scoped>
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: #1f2329;
  overflow-wrap: anywhere;
  word-break: break-word;

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 1em 0 0.5em;
    font-weight: 600;
    line-height: 1.35;
  }

  :deep(h1) {
    font-size: 1.5em;
  }
  :deep(h2) {
    font-size: 1.3em;
  }
  :deep(h3) {
    font-size: 1.15em;
  }

  :deep(p) {
    margin: 0.6em 0;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0.6em 0;
    padding-left: 1.4em;
  }

  :deep(li) {
    margin: 0.25em 0;
  }

  :deep(blockquote) {
    margin: 0.8em 0;
    padding: 0.2em 0.9em;
    color: #4b5563;
    border-left: 3px solid #c7d2fe;
    background: rgba(239, 246, 255, 0.6);
  }

  :deep(code) {
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background: #f3f4f6;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
  }

  :deep(pre) {
    margin: 0.8em 0;
    padding: 12px 14px;
    overflow: auto;
    border-radius: 8px;
    background: #111827;
    color: #f9fafb;

    code {
      padding: 0;
      background: transparent;
      color: inherit;
      font-size: 12.5px;
      line-height: 1.55;
    }
  }

  :deep(a) {
    color: #2563f4;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 6px;
  }

  :deep(table) {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0.8em 0;
    border-collapse: collapse;
    font-size: 13px;
    overflow-x: auto;
  }

  :deep(th),
  :deep(td) {
    border: 1px solid #e5e7eb;
    padding: 6px 10px;
    vertical-align: top;
  }

  :deep(th) {
    background: #f9fafb;
    font-weight: 600;
    white-space: nowrap;
  }

  :deep(hr) {
    margin: 1em 0;
    border: none;
    border-top: 1px solid #e5e7eb;
  }
}
</style>
