import OpenAI from 'openai';
import type { ChatMessage, LlmModelItem } from '../types/chat.js';

export type { ChatMessage, LlmModelItem };

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('未配置 DEEPSEEK_API_KEY，请在 server/.env 中设置');
}

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseURL = (process.env.DEEPSEEK_BASE_URL || '').replace(/\/+$/, '');

const client = new OpenAI({
  apiKey,
  baseURL,
});

export function getDefaultModel() {
  return process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat';
}

/** 解析请求中的模型名；空则回落默认 */
export function resolveModel(model?: unknown) {
  if (typeof model === 'string' && model.trim()) return model.trim();
  return getDefaultModel();
}

type UpstreamModel = {
  id?: string;
  object?: string;
  created?: number;
  owned_by?: string;
  supported_endpoint_types?: string[];
};

/**
 * 查询上游可选模型（OpenAI 兼容 GET /v1/models）。
 * 官方返回形如：{ data: [{ id, object, created, owned_by, supported_endpoint_types }] }
 */
export async function listModels(): Promise<LlmModelItem[]> {
  if (!baseURL) {
    throw Object.assign(new Error('未配置 DEEPSEEK_BASE_URL'), { status: 500 });
  }

  const res = await fetch(`${baseURL}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const body = (await res.json().catch(() => null)) as {
    data?: UpstreamModel[];
    error?: { message?: string };
    message?: string;
  } | null;

  if (!res.ok) {
    const msg = body?.error?.message || body?.message || `查询模型列表失败（HTTP ${res.status}）`;
    throw Object.assign(new Error(msg), { status: res.status });
  }

  const raw = Array.isArray(body?.data) ? body.data : [];
  const items: LlmModelItem[] = raw
    .filter((m): m is UpstreamModel & { id: string } => typeof m?.id === 'string' && !!m.id)
    .map((m) => ({
      id: m.id,
      object: m.object,
      created: m.created,
      ownedBy: m.owned_by,
      supportedEndpointTypes: m.supported_endpoint_types,
    }));

  items.sort((a, b) => a.id.localeCompare(b.id));
  return items;
}

// 非SSE
export async function chatCompletion(messages: ChatMessage[], model?: string) {
  const completion = await client.chat.completions.create({
    model: resolveModel(model),
    messages,
  });
  return completion.choices[0]?.message?.content ?? '';
}

/**
 * 流式聊天：返回一个「可异步遍历」的流。
 * 注意：await create(stream:true) 成功 ≠ 鉴权成功；
 * 无效 Key 等错误往往在消费 iterator 的第一次 next() 时才抛出。
 */
export async function chatCompletionStream(messages: ChatMessage[], model?: string) {
  return client.chat.completions.create({
    model: resolveModel(model),
    messages,
    stream: true,
  });
}
