import type { SystemPromptKey } from '@/types/chat';

/** 各 System Prompt 对应发给模型的 content */
export const SYSTEM_PROMPT_CONTENT: Record<
  Exclude<SystemPromptKey, null>,
  string
> = {
  concise: '回答尽量短，要点列表',
  detailed: '分步骤解释，适当举例',
  translate: '把用户输入翻译成英文，只输出译文',
};

/** 下拉选项（label 展示用，value 对应 SYSTEM_PROMPT_CONTENT） */
export const SYSTEM_PROMPT_OPTIONS: Array<{
  label: string;
  value: Exclude<SystemPromptKey, null>;
}> = [
  { label: '简洁', value: 'concise' },
  { label: '详细', value: 'detailed' },
  { label: '翻译', value: 'translate' },
];
