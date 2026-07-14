<template>
  <SiderTree class="!lrx-p-0">
    <template #left-content>
      <ChatRecord
        ref="chatRecordRef"
        :business-list="businessList"
        :selected-business="selectedBusiness"
        @change-business="onChangeBusiness"
        @change-chat="onChangeChat"
        @change-chat-info="onChangeChatInfo"
      />
    </template>
    <template #right-content>
      <Chat
        ref="chatRef"
        :selected-business="selectedBusiness"
        :is-page="true"
      />
    </template>
  </SiderTree>
</template>
<script setup lang="ts">
import { SiderTree } from '@/components';
import ChatRecord from './components/ChatRecord.vue';
import Chat from './components/Chat.vue';

const businessList = ref<any[]>([]);
const selectedBusiness = ref<any>(null);
const chatRecordRef = ref<InstanceType<typeof ChatRecord>>();
const chatRef = ref<InstanceType<typeof Chat>>();

function onChangeBusiness(business: any) {
  selectedBusiness.value = business;
}

function onChangeChat(_chat: any) {
  // 预留给父子会话联动
}

function onChangeChatInfo(_chatInfo: any) {
  // 预留给历史消息回填
}
</script>
<style lang="less" scoped></style>
