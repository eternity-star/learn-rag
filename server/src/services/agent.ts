import type { Response } from 'express';
import type OpenAI from 'openai';
import { getLlmClient, resolveModel } from './deepseek.js';
import { retrieve } from './indexer.js';
import type { Citation } from '../types/chunk.js';
import { finalizeToolCalls, mergeToolCallDeltas } from '../utils/tool-calls.js';
import type { ToolCallAcc } from '../utils/tool-calls.js';
import {
  flushSse,
  getStreamChunkError,
  getStreamDelta,
  initSseHeaders,
  writeSse,
  writeSseDone,
  writeSseError,
} from '../utils/sse.js';
import { createHttpError } from '../utils/errors.js';
import type { ChatMessage } from '../types/chat.js';

type IncomingMessage = ChatMessage;

/**
 * 工具列表
 * 目前只支持一个工具：ragSearch
 * 靠自然语言约束什么时候需要调用工具，以及调用哪个工具
 */
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'ragSearch',
      description:
        '在本地知识库中检索与问题相关的文档片段。当用户询问产品配置、排查步骤、操作说明等需要依据内部文档的问题时必须调用；闲聊、问候、常识问题不要调用。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '检索用查询语句，可用用户原话或改写后的关键词',
          },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * 在本地知识库中检索与问题相关的文档片段。
 * @param query 检索用查询语句，可用用户原话或改写后的关键词
 * @returns 检索结果
 */
async function runRagSearch(query: string): Promise<{ text: string; hits: Citation[] }> {
  const hits = await retrieve(query, 5);
  const text =
    hits
      .map((h, i) => `[${i + 1}] (${h.source}, score=${h.score.toFixed(3)})\n${h.text}`)
      .join('\n\n') || '未检索到相关片段';
  return { text, hits };
}

/**
 * Agent 流式对话（模型可选择调用 ragSearch）
 * 「模型决策 → 可选执行工具 → 再生成回答」
 * @param res Response 对象
 * @param userMessages 用户消息
 * @param model 模型名称
 * @returns
 */
export async function agentStream(res: Response, userMessages: ChatMessage[], model?: string) {
  const client = getLlmClient();
  const modelName = resolveModel(model);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = userMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  initSseHeaders(res);

  // ---------- 第 1 次：tools + stream ----------
  const firstStream = await client.chat.completions.create({
    model: modelName, // 大模型
    messages, // 用户消息
    tools, // 工具列表
    tool_choice: 'auto', // 自动选择工具
    stream: true, // 流式返回
  });

  // 工具调用Map，key为工具调用索引，value为工具调用对象
  const toolMap = new Map<number, ToolCallAcc & { arguments: string }>();
  let firstContent = '';
  let sawToolCall = false;

  /** 消费第 1 次流式响应 */
  for await (const chunk of firstStream) {
    const chunkError = getStreamChunkError(chunk);
    if (chunkError) throw createHttpError(chunkError, 500);

    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    /**
     * 第一轮流式响应：工具调用
     * 如果模型返回工具调用，则将工具调用添加到工具调用Map中
     * 并继续消费下一轮流式响应
     */
    if (delta.tool_calls?.length) {
      sawToolCall = true;
      mergeToolCallDeltas(toolMap, delta.tool_calls);
      continue;
    }

    /**
     * 第一轮流式响应：模型返回回答
     * 如果模型返回回答，并且还没有看到工具调用，则将回答添加到第一轮回答中
     * 并流式返回给前端
     * 如果模型返回回答，并且已经看到工具调用，则不流式返回给前端
     */
    if (delta.content && !sawToolCall) {
      firstContent += delta.content;
      writeSse(res, { content: delta.content });
      flushSse(res);
    }
  }

  const toolCalls = finalizeToolCalls(toolMap);

  // 情况 A：不调工具 → 第一轮已流完
  if (toolCalls.length === 0) {
    if (!firstContent) {
      writeSseError(res, '模型未返回任何内容，请检查模型是否支持 tools / API Key');
      return;
    }
    writeSseDone(res);
    return;
  }

  // 情况 B：调了工具
  messages.push({
    role: 'assistant',
    content: firstContent || null,
    tool_calls: toolCalls.map((t) => ({
      id: t.id,
      type: 'function',
      function: {
        name: t.name,
        arguments: t.arguments,
      },
    })),
  });

  // 工具调用开始
  writeSse(res, { event: 'tool_start', name: toolCalls[0]!.name });
  flushSse(res);

  let citations: Citation[] = [];

  for (const t of toolCalls) {
    let result = '';
    try {
      if (t.name === 'ragSearch') {
        const args = JSON.parse(t.arguments) as { query: string };
        const out = await runRagSearch(String(args.query ?? '').trim());
        result = out.text;
        citations = out.hits;
      } else {
        result = `未知工具：${t.name}`;
      }
    } catch (e) {
      result = `工具调用失败：${e instanceof Error ? e.message : String(e)}`;
    }

    messages.push({
      role: 'tool',
      tool_call_id: t.id,
      content: result,
    });
  }

  if (citations.length) {
    writeSse(res, {
      citations: citations.map((h) => ({
        id: h.id,
        source: h.source,
        text: h.text.length > 240 ? `${h.text.slice(0, 240)}…` : h.text,
        score: h.score,
      })),
    });
  }

  // 工具调用结束
  writeSse(res, { event: 'tool_end', name: toolCalls[0]!.name });
  flushSse(res);

  // ---------- 第 2 次：流式最终回答 ----------
  const secondStream = await client.chat.completions.create({
    model: modelName,
    messages,
    stream: true,
  });

  let hasContent = false;
  for await (const chunk of secondStream) {
    const chunkError = getStreamChunkError(chunk);
    if (chunkError) throw createHttpError(chunkError, 500);

    const text = getStreamDelta(chunk);
    if (!text) continue;
    hasContent = true;
    writeSse(res, { content: text });
    flushSse(res);
  }

  if (!hasContent) {
    writeSseError(res, '模型未返回任何内容，请检查 API Key / 模型配置后重试');
    return;
  }

  writeSseDone(res);
}
