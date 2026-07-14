import { createRouter, createWebHistory } from 'vue-router';
import AiChat from '@/views/ai-agent/AiChat.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'ai-chat',
      component: AiChat,
    },
  ],
});

export default router;
