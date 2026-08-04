/** 对话角色（模型 API / 持久化共用） */
export type ChatRole = 'system' | 'user' | 'assistant';

/** 调模型用的最小消息结构 */
export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** 上游可选模型（对应官方 /v1/models 的 data 项） */
export type LlmModelItem = {
  id: string;
  object?: string;
  created?: number;
  ownedBy?: string;
  supportedEndpointTypes?: string[];
};
