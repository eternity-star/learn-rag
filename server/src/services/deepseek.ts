import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// 非SSE
export async function chatCompletion(messages: ChatMessage[]) {
  const completion = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL,
    messages,
  });
  return completion.choices[0]?.message?.content ?? '';
}

/**
 * 流式聊天：返回一个「可异步遍历」的流。
 * for await (... of stream) 每循环一次，就拿到模型新吐出的一小段文字。
 */
export async function chatCompletionStream(messages: ChatMessage[]) {
  // stream: true → SDK 不再等整段结果，而是返回异步迭代器
  const stream = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL,
    messages,
    stream: true,
  });
  return stream;
}
