<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="docName || '文档预览'"
    :style="modalStyle"
    :class="{ 'preview-modal--fullscreen': fullscreen }"
    :bordered="false"
    display-directive="if"
    @after-leave="onAfterLeave"
  >
    <template #header-extra>
      <n-button
        quaternary
        circle
        size="small"
        :title="fullscreen ? '退出全屏' : '全屏查看'"
        @click="fullscreen = !fullscreen"
      >
        <template #icon>
          <n-icon :component="fullscreen ? CompressOutlined : ExpandOutlined" :size="18" />
        </template>
      </n-button>
    </template>
    <n-spin :show="loading" class="preview-spin">
      <n-scrollbar :style="scrollStyle">
        <MarkdownView :content="content" allow-html class="md-preview-wrap" />
      </n-scrollbar>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { MarkdownView } from '@/components/markdown-view';
import { fetchDocContent } from '@/services/api/docs-api';
import { getApiError } from '@/services/http';

import ExpandOutlined from '~icons/ant-design/expand-outlined';
import CompressOutlined from '~icons/ant-design/compress-outlined';

const message = useMessage();

const show = ref(false);
const loading = ref(false);
const docName = ref('');
const content = ref('');
const fullscreen = ref(false);

const modalStyle = computed(() =>
  fullscreen.value
    ? {
        width: '100vw',
        maxWidth: '100vw',
        height: '100vh',
        margin: '0',
        borderRadius: '0',
      }
    : {
        width: '960px',
        maxWidth: '94vw',
      },
);

const scrollStyle = computed(() =>
  fullscreen.value ? { height: 'calc(100vh - 72px)' } : { maxHeight: '70vh' },
);

function onAfterLeave() {
  fullscreen.value = false;
  docName.value = '';
  content.value = '';
}

async function open(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  docName.value = trimmed;
  content.value = '';
  show.value = true;
  loading.value = true;
  try {
    const { data } = await fetchDocContent(trimmed);
    content.value = data.content ?? '';
  } catch (err) {
    message.error(getApiError(err, '读取文档失败'));
    show.value = false;
  } finally {
    loading.value = false;
  }
}

defineExpose({ open });
</script>

<style lang="less" scoped>
.md-preview-wrap {
  padding: 4px 2px 12px;
}

:deep(.preview-modal--fullscreen) {
  .n-card {
    height: 100vh;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
    border-radius: 0;
  }

  .n-card__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .preview-spin {
    flex: 1;
    min-height: 0;
  }

  .n-spin-container,
  .n-spin-content {
    height: 100%;
  }
}
</style>
