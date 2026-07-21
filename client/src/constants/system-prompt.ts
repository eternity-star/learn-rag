import type { SystemPromptKey } from '@/types/chat';

/** 各 System Prompt 对应发给模型的 content */
export const SYSTEM_PROMPT_CONTENT: Record<
  Exclude<SystemPromptKey, null>,
  string
> = {
  concise: '回答尽量短，要点列表',
  detailed: '分步骤解释，适当举例',
  translate: '把用户输入翻译成英文，只输出译文',
  structured:
    '必须返回结构化数据{"type":"...","summary":"...","tags":["a","b"],"emotion":"愉快","content":""}，其中 type 为类型（如总结、查询、问答等），summary 是对回答内容的总结，tags 是对这部分内容的标签，content 是原输出内容，emotion 是回答的语气。只输出该 JSON，不要其它说明文字。',
};

/** 下拉选项（label 展示用，value 对应 SYSTEM_PROMPT_CONTENT） */
export const SYSTEM_PROMPT_OPTIONS: Array<{
  label: string;
  value: Exclude<SystemPromptKey, null>;
}> = [
  { label: '简洁', value: 'concise' },
  { label: '详细', value: 'detailed' },
  { label: '翻译', value: 'translate' },
  { label: '结构化输出', value: 'structured' },
];
