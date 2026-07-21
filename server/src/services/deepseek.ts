import OpenAI from 'openai';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('未配置 DEEPSEEK_API_KEY，请在 server/.env 中设置');
}

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

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
 * 注意：await create(stream:true) 成功 ≠ 鉴权成功；
 * 无效 Key 等错误往往在消费 iterator 的第一次 next() 时才抛出。
 */
export async function chatCompletionStream(messages: ChatMessage[]) {
  return client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL,
    messages,
    stream: true,
  });
}
