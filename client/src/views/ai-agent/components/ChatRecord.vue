<template>
  <div class="chat-record">
    <div class="record-header">
      <n-button
        type="default"
        class="lrx-w-full"
        style="
          width: 100%;
          color: #3872fc;
          background-color: #fff;
          border-color: #3872fc;
        "
        @click="addChat"
      >
        新建对话
      </n-button>
      <div style="text-align: left; padding-top: 20px; color: black">
        历史记录
      </div>
    </div>
    <div class="record-list">
      <div
        v-for="item in recordList"
        :key="item.chatId || item.id || item.title"
        class="record-item"
        :class="{
          selected: selectedChat && selectedChat.chatId === item.chatId,
        }"
        @click="changeChat(item)"
      >
        <span style="flex: 1" class="text-overflow">
          <n-spin v-if="item.isLoading" size="small" />
          {{ item.title }}
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
import DeleteOutlined from '~icons/ant-design/delete-outlined';

const emit = defineEmits<{
  (e: 'changeChat', chat: any): void;
  (e: 'changeChatInfo', chatInfo: any): void;
}>();

const message = useMessage();
const dialog = useDialog();

const selectedChat = ref<any>(null);
const recordList = ref<any[]>([]);

onMounted(() => {
  getChatAllAiHistory();
});

function addChat() {
  if (recordList.value.find(it => !it.chatId)) return;
  const item = {
    chatId: '',
    title: '新的对话',
  };
  recordList.value.unshift(item);
  selectedChat.value = item;
  emit('changeChat', item);
  emit('changeChatInfo', []);
}

function deleteChat(it: any) {
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

async function handlerDelete(it: any) {
  try {
    const res = await fetch('/process/ai/deleteHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: it.id }),
    });
    const data = await res.json();
    const { success, msg } = data;
    if (success) {
      if (selectedChat.value?.chatId === it.chatId) {
        selectedChat.value = null;
        emit('changeChat', null);
        emit('changeChatInfo', []);
      }
      await getChatAllAiHistory();
    } else {
      message.error(msg);
    }
  } catch {
    message.error('删除失败');
  }
}

async function getChatAllAiHistory() {
  try {
    const res = await fetch('/process/ai/chatAiHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const { success, data: resData, msg } = data;
    if (success) {
      recordList.value = (resData || [])
        .slice()
        .sort((a: any, b: any) =>
          a.createdTime > b.createdTime ? -1 : 1,
        );
    } else {
      message.error(msg);
    }
  } catch {
    message.error('获取历史记录失败');
  }
}

function changeChat(it: any) {
  selectedChat.value = it;
  queryChatInfo(it);
  emit('changeChat', it);
}

async function queryChatInfo(otem: any) {
  if (!otem?.chatId) {
    emit('changeChatInfo', []);
    return;
  }
  otem.isLoading = true;
  try {
    const res = await fetch('/process/ai/queryChatInfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: otem.chatId,
        type: otem.type,
      }),
    });
    const data = await res.json();
    const { success, data: resData, msg } = data;
    if (success) {
      emit('changeChatInfo', resData || []);
    } else {
      message.error(msg);
    }
  } catch {
    message.error('获取历史记录失败');
  } finally {
    otem.isLoading = false;
  }
}
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
  height: calc(100% - 120px);
  overflow-y: auto;
  .record-item {
    display: flex;
    align-items: center;
    margin: 6px 0;
    padding: 6px 8px;
    border-radius: 5px;
    color: black;
    cursor: pointer;
    &:hover {
      background-color: #e5e5e5;
      .delete-icon {
        display: inline-flex;
      }
    }
    &.selected {
      background-color: #e5e5e5;
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
