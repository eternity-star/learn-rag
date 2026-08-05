<template>
  <div class="chat-record">
    <div class="record-header">
      <n-button
        type="default"
        class="lrx-w-full"
        style="width: 100%; color: #3872fc; background-color: #fff; border-color: #3872fc"
        :loading="creating"
        @click="addChat"
      >
        新建对话
      </n-button>
      <n-button class="lrx-w-full lrx-mt-2" quaternary type="primary" @click="goDocsHome">
        知识库管理
      </n-button>
      <div style="text-align: left; padding-top: 20px; color: black">历史记录</div>
    </div>
    <div class="record-list">
      <div
        v-for="item in recordList"
        :key="item.id"
        class="record-item"
        :class="{
          selected: selectedChat && selectedChat.id === item.id,
        }"
        @click="changeChat(item)"
      >
        <span class="record-title text-overflow">
          <n-spin v-if="loadingId === item.id" :size="12" class="record-spin" />
          <span class="record-title-text">{{ item.title }}</span>
        </span>
        <n-icon
          class="delete-icon"
          style="cursor: pointer"
          :component="DeleteOutlined"
          @click.stop="deleteChat(item)"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router';
import DeleteOutlined from '~icons/ant-design/delete-outlined';
import {
  createConversation,
  fetchConversation,
  fetchConversations,
  removeConversation,
} from '@/services/api/conversations-api';
import { getApiError } from '@/services/http';
import type { ChatMessage, ConversationSummary } from '@/types/chat';

const emit = defineEmits<{
  (e: 'changeChat', chat: ConversationSummary | null): void;
  (e: 'changeChatInfo', messages: ChatMessage[]): void;
}>();

const router = useRouter();
const message = useMessage();
const dialog = useDialog();

const selectedChat = ref<ConversationSummary | null>(null);
const recordList = ref<ConversationSummary[]>([]);
const creating = ref(false);
const loadingId = ref('');

function goDocsHome() {
  router.push({ name: 'docs-home' });
}

async function loadList() {
  try {
    const { data } = await fetchConversations();
    recordList.value = data.conversations || [];
  } catch (err) {
    message.error(getApiError(err, '获取历史记录失败'));
  }
}

async function addChat() {
  if (creating.value) return;
  creating.value = true;
  try {
    const { data } = await createConversation();
    const conversation = data.conversation;
    const summary: ConversationSummary = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
    recordList.value = [summary, ...recordList.value.filter((it) => it.id !== summary.id)];
    selectedChat.value = summary;
    emit('changeChat', summary);
    emit('changeChatInfo', []);
  } catch (err) {
    message.error(getApiError(err, '新建对话失败'));
  } finally {
    creating.value = false;
  }
}

function deleteChat(it: ConversationSummary) {
  dialog.warning({
    title: '提示',
    content: '确认删除该会话吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await handlerDelete(it);
    },
  });
}

async function handlerDelete(it: ConversationSummary) {
  try {
    await removeConversation(it.id);
    if (selectedChat.value?.id === it.id) {
      selectedChat.value = null;
      emit('changeChat', null);
      emit('changeChatInfo', []);
    }
    message.success('删除成功');
    await loadList();
  } catch (err) {
    message.error(getApiError(err, '删除失败'));
  }
}

function changeChat(it: ConversationSummary) {
  selectedChat.value = it;
  emit('changeChat', it);
  queryChatInfo(it);
}

async function queryChatInfo(item: ConversationSummary) {
  loadingId.value = item.id;
  try {
    const { data } = await fetchConversation(item.id);
    emit('changeChatInfo', data.conversation?.messages || []);
  } catch (err) {
    message.error(getApiError(err, '获取历史记录失败'));
    emit('changeChatInfo', []);
  } finally {
    loadingId.value = '';
  }
}

/** 供父组件在消息保存后刷新标题/排序 */
async function reloadList(preferId?: string) {
  await loadList();
  if (preferId) {
    const found = recordList.value.find((it) => it.id === preferId);
    if (found) selectedChat.value = found;
  }
}

function patchSummary(summary: ConversationSummary) {
  const idx = recordList.value.findIndex((it) => it.id === summary.id);
  if (idx >= 0) {
    recordList.value[idx] = summary;
  } else {
    recordList.value.unshift(summary);
  }
  recordList.value = [...recordList.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  // 自动创建或当前选中时，同步高亮
  if (!selectedChat.value || selectedChat.value.id === summary.id) {
    selectedChat.value = summary;
  }
}

onMounted(() => {
  loadList();
});

defineExpose({
  reloadList,
  patchSummary,
  addChat,
});
</script>
<style lang="less" scoped>
.chat-record {
  height: 100%;
  background-color: #f6f6f6;
  .record-header {
    text-align: center;
    padding: 10px 10px 10px;
    :deep(.n-btn:hover),
    :deep(.n-btn.active) {
      background-color: #ecf5ff !important;
    }
  }
}
.record-list {
  padding: 0 2px;
  height: calc(100% - 140px);
  overflow-y: auto;
  .record-item {
    display: flex;
    align-items: center;
    margin: 6px 0;
    padding: 6px 8px;
    border-radius: 5px;
    color: black;
    cursor: pointer;
    line-height: 21px;
    min-height: 33px; // 6+6 padding + 21 line-height，有无 loading 一致
    box-sizing: border-box;
    &:hover {
      background-color: #e5e5e5;
      .delete-icon {
        display: inline-flex;
      }
    }
    &.selected {
      background-color: #e5e5e5;
    }
    .record-title {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .record-title-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .record-spin {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      :deep(.n-spin) {
        --n-size: 12px !important;
        width: 12px;
        height: 12px;
      }
    }
    .delete-icon {
      display: none;
      line-height: 21px;
      flex-shrink: 0;
    }
  }
}
.text-overflow {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
