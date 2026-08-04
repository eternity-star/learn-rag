<template>
  <div class="docs-home lrx-h-full lrx-w-full lrx-flex lrx-flex-col lrx-box-border">
    <header class="docs-header">
      <div class="docs-title-wrap">
        <h1 class="docs-title">知识库管理</h1>
        <n-tag size="small" :bordered="false">MD / TXT</n-tag>
        <n-tooltip placement="bottom-start">
          <template #trigger>
            <span class="docs-hint">{{ docsHintText }}</span>
          </template>
          {{ docsHintText }}
        </n-tooltip>
      </div>
      <div class="lrx-flex lrx-items-center lrx-gap-2">
        <n-button quaternary @click="goChat">
          <template #icon>
            <n-icon :component="MessageOutlined" />
          </template>
          返回问答
        </n-button>
        <n-button :loading="loading" @click="loadDocs">
          <template #icon>
            <n-icon :component="ReloadOutlined" />
          </template>
          刷新
        </n-button>
        <n-button type="primary" secondary @click="openCreateModal">
          <template #icon>
            <n-icon :component="PlusOutlined" />
          </template>
          新建文档
        </n-button>
        <n-upload
          :show-file-list="false"
          accept=".md,.txt,text/markdown,text/plain"
          :custom-request="onUploadFile"
        >
          <n-button type="primary">
            <template #icon>
              <n-icon :component="UploadOutlined" />
            </template>
            上传文件
          </n-button>
        </n-upload>
        <n-button type="warning" :loading="reindexing" @click="onReindex">
          <template #icon>
            <n-icon :component="DatabaseOutlined" />
          </template>
          重建索引
        </n-button>
      </div>
    </header>

    <div class="docs-toolbar">
      <n-input
        v-model:value="nameInput"
        clearable
        placeholder="搜索文件名，回车检索"
        class="docs-search"
        @keyup.enter="applyNameSearch"
        @clear="applyNameSearch"
      >
        <template #prefix>
          <n-icon :component="SearchOutlined" />
        </template>
      </n-input>
      <span class="docs-count">
        {{ filteredDocs.length }}{{ nameQuery ? ` / ${docs.length}` : '' }} 个文件
      </span>
    </div>

    <div class="docs-table-wrap">
      <n-data-table
        :columns="columns"
        :data="filteredDocs"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        size="medium"
        flex-height
        class="lrx-h-full"
        :row-props="rowProps"
      />
    </div>

    <n-modal
      v-model:show="showModal"
      preset="card"
      :title="editingName ? `编辑：${editingName}` : '新建文档'"
      style="width: 720px; max-width: 92vw"
      :mask-closable="!saving"
    >
      <n-form label-placement="top">
        <n-form-item label="文件名" required>
          <n-input
            v-model:value="formName"
            placeholder="例如 demo.md"
            :disabled="!!editingName || saving"
          />
        </n-form-item>
        <n-form-item label="正文" required>
          <n-input
            v-model:value="formContent"
            type="textarea"
            placeholder="Markdown / 纯文本内容"
            :autosize="{ minRows: 12, maxRows: 24 }"
            :disabled="saving"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="lrx-flex lrx-justify-end lrx-gap-2">
          <n-button :disabled="saving" @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="onSaveDoc">保存</n-button>
        </div>
      </template>
    </n-modal>

    <DocPreviewModal ref="docPreviewRef" />
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon, type DataTableColumns, type UploadCustomRequestOptions } from 'naive-ui';
import type { RagDocItem } from '@/types/docs';
import {
  fetchDocs,
  uploadDoc,
  removeDoc,
  reindexDocs,
} from '@/services/api/docs-api';
import { getApiError } from '@/services/http';
import { DocPreviewModal } from '@/components';
import { useRouter } from 'vue-router';

import MessageOutlined from '~icons/ant-design/message-outlined';
import ReloadOutlined from '~icons/ant-design/reload-outlined';
import PlusOutlined from '~icons/ant-design/plus-outlined';
import UploadOutlined from '~icons/ant-design/upload-outlined';
import DatabaseOutlined from '~icons/ant-design/database-outlined';
import DeleteOutlined from '~icons/ant-design/delete-outlined';
import SearchOutlined from '~icons/ant-design/search-outlined';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();

const docsHintText =
  '双击行可查看文档内容。上传或删除文档后，请点击「重建索引」才会更新向量库；重建可能需数分钟（本地 Embedding）。';

const docs = ref<RagDocItem[]>([]);
/** 输入框草稿；真正过滤用 nameQuery，仅回车 / 清空时更新 */
const nameInput = ref('');
const nameQuery = ref('');
const loading = ref(false);

function applyNameSearch() {
  nameQuery.value = nameInput.value.trim();
}

/** 按文件名模糊过滤（忽略大小写） */
const filteredDocs = computed(() => {
  const kw = nameQuery.value.toLowerCase();
  if (!kw) return docs.value;
  return docs.value.filter((d) => d.name.toLowerCase().includes(kw));
});
const saving = ref(false);
const reindexing = ref(false);

const showModal = ref(false);
const editingName = ref('');
const formName = ref('');
const formContent = ref('');

const docPreviewRef = ref<InstanceType<typeof DocPreviewModal>>();

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function goChat() {
  router.push({ name: 'ai-chat' });
}

async function loadDocs() {
  loading.value = true;
  try {
    const { data } = await fetchDocs();
    docs.value = data.docs ?? [];
  } catch (err) {
    message.error(getApiError(err, '加载文档失败'));
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingName.value = '';
  formName.value = '';
  formContent.value = '';
  showModal.value = true;
}

function openPreview(row: RagDocItem) {
  docPreviewRef.value?.open(row.name);
}

function rowProps(row: RagDocItem) {
  return {
    style: 'cursor: pointer',
    onDblclick: () => openPreview(row),
  };
}

async function onSaveDoc() {
  const name = formName.value.trim();
  const content = formContent.value;
  if (!name) {
    message.warning('请填写文件名');
    return;
  }
  if (!/\.(md|txt)$/i.test(name)) {
    message.warning('文件名需以 .md 或 .txt 结尾');
    return;
  }
  if (!content.trim()) {
    message.warning('正文不能为空');
    return;
  }

  saving.value = true;
  try {
    await uploadDoc(name, content);
    message.success('已保存到知识库，记得重建索引');
    showModal.value = false;
    await loadDocs();
  } catch (err) {
    message.error(getApiError(err, '保存失败'));
  } finally {
    saving.value = false;
  }
}

function onUploadFile({ file, onFinish, onError }: UploadCustomRequestOptions) {
  const raw = file.file;
  if (!raw) {
    onError();
    return;
  }
  const name = raw.name;
  if (!/\.(md|txt)$/i.test(name)) {
    message.warning('仅支持 .md / .txt');
    onError();
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const content = String(reader.result ?? '');
      if (!content.trim()) {
        message.warning('文件内容为空');
        onError();
        return;
      }
      await uploadDoc(name, content);
      message.success(`已上传 ${name}，记得重建索引`);
      onFinish();
      await loadDocs();
    } catch (err) {
      message.error(getApiError(err, '上传失败'));
      onError();
    }
  };
  reader.onerror = () => {
    message.error('读取文件失败');
    onError();
  };
  reader.readAsText(raw, 'utf-8');
}

function confirmDelete(row: RagDocItem) {
  dialog.warning({
    title: '删除文档',
    content: `确定删除「${row.name}」？删除后需重建索引才会从检索中移除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await removeDoc(row.name);
        message.success('已删除');
        await loadDocs();
      } catch (err) {
        message.error(getApiError(err, '删除失败'));
      }
    },
  });
}

function onReindex() {
  const d = dialog.info({
    title: '重建索引',
    content: '将对 data/docs 下全部文档重新切分并生成向量，可能需要数分钟，确定继续？',
    positiveText: '开始重建',
    negativeText: '取消',
    onPositiveClick: () => {
      d.loading = true;
      reindexing.value = true;
      return reindexDocs()
        .then(({ data }) => {
          message.success(`索引重建完成，共 ${data.chunks} 个片段`);
        })
        .catch((err) => {
          message.error(getApiError(err, '重建索引失败'));
          return false;
        })
        .finally(() => {
          d.loading = false;
          reindexing.value = false;
        });
    },
  });
}

const columns = computed<DataTableColumns<RagDocItem>>(() => [
  {
    title: '文件名',
    key: 'name',
    ellipsis: { tooltip: true },
    sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'),
  },
  {
    title: '大小',
    key: 'size',
    width: 120,
    sorter: (a, b) => a.size - b.size,
    render: (row) => formatSize(row.size),
  },
  {
    title: '更新时间',
    key: 'mtime',
    width: 200,
    sorter: (a, b) => new Date(a.mtime).getTime() - new Date(b.mtime).getTime(),
    defaultSortOrder: 'descend',
    render: (row) => formatTime(row.mtime),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          type: 'error',
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            confirmDelete(row);
          },
        },
        {
          icon: () => h(NIcon, { component: DeleteOutlined }),
          default: () => '删除',
        },
      ),
  },
]);

onMounted(() => {
  loadDocs();
});
</script>

<style lang="less" scoped>
.docs-home {
  height: 100%;
  padding: 20px 24px;
  background: #f7f8fa;
}

.docs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.docs-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.docs-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
  flex-shrink: 0;
}

.docs-hint {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
  cursor: default;
}

.docs-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.docs-search {
  width: 280px;
  max-width: 100%;
}

.docs-count {
  flex-shrink: 0;
  font-size: 13px;
  color: #8a8f98;
}

.docs-table-wrap {
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

</style>
