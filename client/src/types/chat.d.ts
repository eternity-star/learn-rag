/** 消息角色 */
export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole; // 消息角色
  content: string; // 消息内容
  isStream?: number; // 是否流式返回 1-是 0-否
  time?: string; // 消息时间
  isMsgLoading?: boolean; // 消息是否显示加载中 当是流式返回json时需要等待全部数据返回后在停止渲染；当流式返回文本时不需要等待全部数据返回后在停止渲染
  isError?: boolean; // 消息是否错误
};

/** System Prompt 选项 key；null 表示不使用 */
export type SystemPromptKey =
  | 'concise'
  | 'detailed'
  | 'translate'
  | 'structured'
  | null;

