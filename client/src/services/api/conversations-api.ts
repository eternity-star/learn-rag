import { http } from '../http';
import type { ChatMessage, Conversation, ConversationSummary } from '@/types/chat';
import type { HttpResponse } from '../http/types';

/** 对话列表 GET /conversations/query */
export const fetchConversations = (): Promise<
  HttpResponse<{ conversations: ConversationSummary[] }>
> => {
  return http.request({
    url: '/conversations/query',
    method: 'GET',
  });
};

/** 新建对话 POST /conversations/create */
export const createConversation = (
  title?: string,
): Promise<HttpResponse<{ conversation: Conversation }>> => {
  return http.request({
    url: '/conversations/create',
    method: 'POST',
    data: title ? { title } : {},
  });
};

/** 对话详情 GET /conversations/get/:id */
export const fetchConversation = (
  id: string,
): Promise<HttpResponse<{ conversation: Conversation }>> => {
  return http.request({
    url: `/conversations/get/${encodeURIComponent(id)}`,
    method: 'GET',
  });
};

/** 更新标题 / 消息 POST /conversations/update/:id */
export const updateConversation = (
  id: string,
  patch: { title?: string; messages?: ChatMessage[] },
): Promise<HttpResponse<{ conversation: Conversation }>> => {
  return http.request({
    url: `/conversations/update/${encodeURIComponent(id)}`,
    method: 'POST',
    data: patch,
  });
};

/** 删除对话 POST /conversations/delete/:id */
export const removeConversation = (
  id: string,
): Promise<HttpResponse<{ ok: boolean; id: string }>> => {
  return http.request({
    url: `/conversations/delete/${encodeURIComponent(id)}`,
    method: 'POST',
  });
};
