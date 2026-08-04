import type { ChatMessage } from './chat.js';
import type { RetrieveHit } from './chunk.js';

/**
 * 写入 conversations.json 的单条消息。
 * 在 ChatMessage 上扩展 UI/引用字段；citations 与检索命中 RetrieveHit 同形。
 */
export type ConversationMessage = ChatMessage & {
  isStream?: number; // 是否流式返回 1-是 0-否
  time?: string; // 消息时间
  isMsgLoading?: boolean; // 消息是否显示加载中 当是流式返回json时需要等待全部数据返回后在停止渲染；当流式返回文本时不需要等待全部数据返回后在停止渲染
  isRetrieving?: boolean; // Agent 工具检索中（tool_start → tool_end / 首字 content）
  isError?: boolean; // 消息是否错误
  citations?: RetrieveHit[]; // 引用资料
};

/** 完整对话 */
export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

/** 列表项：不带 messages，减轻载荷 */
export type ConversationSummary = Omit<Conversation, 'messages'>;
