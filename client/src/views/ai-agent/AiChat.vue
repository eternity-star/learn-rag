<template>
  <SiderTree class="!lrx-p-0">
    <template #left-content>
      <ChatRecord
        ref="chatRecordRef"
        @change-chat="onChangeChat"
        @change-chat-info="onChangeChatInfo"
      />
    </template>
    <template #right-content>
      <Chat
        ref="chatRef"
        :is-page="true"
        @conversation-updated="onConversationUpdated"
      />
    </template>
  </SiderTree>
</template>
<script setup lang="ts">
import { SiderTree } from '@/components';
import ChatRecord from './components/ChatRecord.vue';
import Chat from './components/Chat.vue';
import type { ChatMessage, ConversationSummary } from '@/types/chat';

const chatRecordRef = ref<InstanceType<typeof ChatRecord>>();
const chatRef = ref<InstanceType<typeof Chat>>();

function onChangeChat(chat: ConversationSummary | null) {
  chatRef.value?.setConversation?.(chat);
}

function onChangeChatInfo(messages: ChatMessage[]) {
  chatRef.value?.loadMessages?.(messages);
}

function onConversationUpdated(summary: ConversationSummary) {
  chatRecordRef.value?.patchSummary?.(summary);
}
</script>
<style lang="less" scoped></style>
