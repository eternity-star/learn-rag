import { createRouter, createWebHistory } from 'vue-router';
import AiChat from '@/views/ai-agent/AiChat.vue';
import DocsHome from '@/views/docs-home/DocsHome.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'ai-chat',
      component: AiChat,
    },
    {
      path: '/docs',
      name: 'docs-home',
      component: DocsHome,
    },
  ],
});

export default router;
