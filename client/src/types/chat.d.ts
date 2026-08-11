/** 消息角色 */
export type ChatRole = 'system' | 'user' | 'assistant';

/** Agent 工具调用步骤 */
export type ToolStep = {
  round: number;
  name: string;
  status: 'running' | 'ok' | 'error';
  args?: Record<string, string>;
  result?: string;
  error?: string;
};

export type ChatMessage = {
  role: ChatRole; // 消息角色
  content: string; // 消息内容
  isStream?: number; // 是否流式返回 1-是 0-否
  time?: string; // 消息时间
  isMsgLoading?: boolean; // 消息是否显示加载中 当是流式返回json时需要等待全部数据返回后在停止渲染；当流式返回文本时不需要等待全部数据返回后在停止渲染
  isRetrieving?: boolean; // Agent 工具检索中（tool_start → tool_end / 首字 content）
  isError?: boolean; // 消息是否错误
  citations?: RagCitation[]; // 引用资料
  toolSteps?: ToolStep[]; // Agent 工具调用轨迹
};

/** System Prompt 选项 key；null 表示不使用 */
export type SystemPromptKey = 'concise' | 'detailed' | 'translate' | 'structured' | null;

export type RagCitation = {
  id: string;
  source: string;
  text: string;
  score: number;
};

/** 上游可选模型（对应官方 /v1/models 的 data 项） */
export type LlmModelItem = {
  id: string;
  object?: string;
  created?: number;
  ownedBy?: string;
  supportedEndpointTypes?: string[];
};

/** 对话列表项（不含 messages） */
export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

/** 完整对话（与 server conversations 对齐） */
export type Conversation = ConversationSummary & {
  messages: ChatMessage[];
};
