<template>
  <div class="chat-record">
    <div class="record-header">
      <n-button
        type="default"
        icon="plus"
        class="lrx-w-full"
        style="
          width: 100%;
          color: #3872fc;
          background-color: #fff;
          border-color: #3872fc;
        "
        @click="addChat"
        >新建对话</n-button
      >
      <div style="text-align: left; padding-top: 20px; color: black">
        历史记录
      </div>
    </div>
    <div class="record-list">
      <div
        :class="['record-item']"
        v-for="(item, index) in recordBusinessList"
        :key="index"
      >
        <div
          @click="changeIsOpen(item)"
          style="cursor: pointer"
          :class="[
            'header-item',
            'text-overflow',
            selectedBusiness &&
            selectedBusiness.instructType === item.instructType
              ? 'selected'
              : '',
          ]"
        >
          <span style="line-height: 32px; margin-right: 3px; color: black">
            <n-icon v-if="item.isLoading" type="loading" />
            <n-icon v-else :type="item.isOpen ? 'caret-down' : 'caret-right'"
          /></span>
          <span style="font-size: 16px; color: #000000">{{
            item.instructName
          }}</span>
        </div>
        <div v-if="item.isOpen">
          <div
            @click="changeChat(item, it)"
            v-for="it in item.recordList"
            :key="it.chatId"
            style="margin-left: 25px"
            :class="[
              'header-item',
              'chat-item',
              selectedChat && selectedChat.chatId == it.chatId
                ? 'selected'
                : '',
            ]"
          >
            <span style="flex: 1" class="text-overflow">
              <n-icon v-if="it.isLoading" type="loading" />
              {{ it.title }}
            </span>
            <n-icon
              class="delete-icon"
              style="cursor: pointer"
              type="delete"
              @click.stop="deleteChat(it)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { cloneDeep } from 'lodash-es';
const props = withDefaults(
  defineProps<{
    businessList?: any[];
    selectedBusiness?: any;
  }>(),
  {
    businessList: () => [],
    selectedBusiness: null,
  },
);

const emit = defineEmits<{
  (e: 'changeBusiness', business: any): void;
  (e: 'changeChat', chat: any): void;
  (e: 'changeChatInfo', chatInfo: any): void;
}>();

const message = useMessage();
const dialog = useDialog();

const { businessList, selectedBusiness } = toRefs(props);
const selectedChat = ref<any>(null);
const recordBusinessList = ref<any[]>([]);

watch(
  businessList,
  () => {
    recordBusinessList.value = cloneDeep(businessList.value);
    if (recordBusinessList.value.length) {
      getChatAllAiHistory(false);
    }
  },
  { immediate: true, deep: true },
);

watch(
  selectedBusiness,
  val => {
    if (val) {
      let find = recordBusinessList.value.find(
        item => item.instructType == val.instructType,
      );
    }
  },
  { immediate: true, deep: true },
);

// 新建一个会话
async function addChat() {
  let find = recordBusinessList.value.find(
    item => item.instructType == selectedBusiness.value?.instructType,
  );
  if (!find) {
    message.info('请先选择一个业务对象');
    return;
  }
  if (!find.recordList) find.recordList = [];
  if (find.recordList?.find(it => !it.chatId)) return;
  let otem = {
    chatId: '',
    title: '新的对话',
  };
  find.recordList.unshift(otem);
  selectedChat.value = otem;
  find.isOpen = true;
  recordBusinessList.value.splice(1, 0);
}

function deleteChat(it) {
  dialog.warning({
    title: '提示',
    content: '确认删除该会话吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      handlerDelete(it);
    },
  });
}

async function handlerDelete(it) {
  const { data } = await axios({
    url: '/ai/deleteHistory',
    method: 'post',
    baseURL: '/process',
    data: {
      id: it.id,
    },
  });
  const { success, data: resData, msg } = data;
  if (success) {
    getChatAllAiHistory();
  } else {
    message.error(msg);
  }
}
async function getChatAllAiHistory(isFirst = true) {
  const { data } = await axios({
    url: '/ai/chatAiHistory',
    method: 'post',
    baseURL: '/process',
  }).catch(() => {
    recordBusinessList.value.splice(1, 0);
    message.error('获取历史记录失败');
    return;
  });
  const { success, data: resData, msg } = data;
  if (success) {
    recordBusinessList.value.forEach(item => {
      let recordList = resData.filter(it => it.type === item.instructType);
      item.recordList = [];
      if (recordList.length) {
        item.recordList = recordList;
        item.recordList.sort((a, b) =>
          a.createdTime > b.createdTime ? -1 : 1,
        );
      }
    });
    recordBusinessList.value.splice(1, 0);
    if (!isFirst) {
      emit('changeBusiness', selectedBusiness.value);
    }
  } else {
    message.error(msg);
  }
}

function changeIsOpen(item) {
  item.isOpen = !item.isOpen;
  if (selectedChat.value?.type != item.instructType) {
    changeChat(item, null);
  }
  recordBusinessList.value.splice(1, 0);
  emit('changeBusiness', item);
}
function changeChat(item, it) {
  if (item.instructType !== selectedBusiness.value?.instructType) {
    emit('changeBusiness', item);
  }
  selectedChat.value = it;
  queryChatInfo(item, it);
  emit('changeChat', it);
}
// 查询会话记录
async function queryChatInfo(item, otem) {
  if (!otem) return;
  otem.isLoading = true;
  const { data } = await axios({
    url: '/ai/queryChatInfo',
    method: 'post',
    baseURL: '/process',
    data: {
      chatId: otem.chatId,
      type: selectedBusiness.value.instructType,
    },
  }).catch(() => {
    otem.isLoading = false;
    message.error('获取历史记录失败');
    return;
  });
  otem.isLoading = false;
  item.recordList.splice(1, 0);
  recordBusinessList.value.splice(1, 0);
  const { success, data: resData, msg } = data;
  if (success) {
    emit('changeChatInfo', resData || []);
  } else {
    message.error(msg);
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
  padding: 0 2px 0 2px;
  height: calc(100% - 120px);
  overflow-y: auto;
  .record-item {
    cursor: pointer;
    border-radius: 5px;
    color: black;
    .header-item {
      padding: 6px 8px;
      border-radius: 5px;
      &:hover {
        background-color: #e5e5e5;
      }
    }
    .chat-item {
      margin: 6px 0;
      display: flex;
      .delete-icon {
        display: none;
        line-height: 21px;
      }
      &:hover {
        .delete-icon {
          display: inline-block;
        }
      }
    }
  }
  .selected {
    background-color: #e5e5e5;
  }
}
</style>
