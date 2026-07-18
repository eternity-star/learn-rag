import { http } from '../http';
import type { ChatMessage } from '@/types/chat';
import type { AxiosResponse } from 'axios';

/**
 * 非流式聊天
 * @param messages 消息
 * @returns 非流式聊天响应
 */
export const chatIndex = (
  messages: ChatMessage[],
): Promise<AxiosResponse<{ content: string }>> => {
  return http.request({
    url: '/chat/index',
    method: 'POST',
    data: { messages },
  });
};
