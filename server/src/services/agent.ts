import type { Response } from 'express';
import type OpenAI from 'openai';
import { getLlmClient, resolveModel } from './deepseek.js';
import { retrieve } from './indexer.js';
import { listDocs } from './docs.js';
import type { Citation } from '../types/chunk.js';
import { finalizeToolCalls, mergeToolCallDeltas } from '../utils/tool-calls.js';
import type { ToolCallAcc } from '../utils/tool-calls.js';
import type { FinalToolCall } from '../utils/tool-calls.js';
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

/** 最多几轮「模型喊工具 → 你执行 → 回灌」；不含最后的强制收尾 */
const MAX_TOOL_ROUNDS = 3;

/** 一轮对话的返回结果 */
type RoundResult =
  | { kind: 'final'; hasContent: boolean }
  | { kind: 'tools'; toolCalls: FinalToolCall[]; assistantContent: string };

/** 去掉模型泄漏到正文里的 DSML / 伪 tool_calls 标记 */
function stripLeakedToolMarkup(text: string): string {
  return (
    text
      // DeepSeek DSML 块（含你截图里的形式）
      .replace(/<\|?DSML\|?tool_calls>[\s\S]*?<\/\|?DSML\|?tool_calls>/gi, '')
      .replace(/<｜DSML｜tool_calls>[\s\S]*?<\/｜DSML｜tool_calls>/gi, '')
      .replace(/<\|?DSML\|?invoke[\s\S]*?<\/\|?DSML\|?invoke>/gi, '')
      .replace(/<｜DSML｜invoke[\s\S]*?<\/｜DSML｜invoke>/gi, '')
      .replace(/<\|?DSML\|?parameter[\s\S]*?<\/\|?DSML\|?parameter>/gi, '')
      .replace(/<｜DSML｜parameter[\s\S]*?<\/｜DSML｜parameter>/gi, '')
      // 残留单标签
      .replace(/<\/?\|?DSML\|?[^>]*>/gi, '')
      .replace(/<\/?｜DSML｜[^>]*>/gi, '')
      .replace(/tool_calls>/gi, '')
      // 常见函数调用伪代码
      .replace(/```(?:json|xml)?\s*\{[\s\S]*?"name"\s*:\s*"ragSearch"[\s\S]*?\}\s*```/gi, '')
  );
}

/**
 * 流式清洗：标签可能跨 chunk，先缓冲再吐「已稳定」的干净增量。
 */
class StreamContentSanitizer {
  private raw = '';
  private cleanEmittedLen = 0;
  /** 喂入一小段，返回本次可安全推给前端的文本（可能为空） */
  push(piece: string): string {
    this.raw += piece;
    // 末尾像未闭合标签时先不吐，等后续 chunk
    if (this.hasIncompleteMarker(this.raw)) return '';
    const clean = stripLeakedToolMarkup(this.raw);
    if (clean.length <= this.cleanEmittedLen) return '';
    const delta = clean.slice(this.cleanEmittedLen);
    this.cleanEmittedLen = clean.length;
    return delta;
  }

  /** 流结束时把剩余干净文本吐出 */
  flush(): string {
    const clean = stripLeakedToolMarkup(this.raw);
    const delta = clean.slice(this.cleanEmittedLen);
    this.raw = '';
    this.cleanEmittedLen = 0;
    return delta;
  }

  private hasIncompleteMarker(s: string): boolean {
    // 普通 < 或 DeepSeek 全角分隔的 DSML 开头未闭合
    if (/<\|?[^>\n]*$/.test(s)) return true;
    if (/<｜[^｜\n]*$/.test(s)) return true;
    if (/<｜DSML｜[^>]*$/.test(s)) return true;
    return false;
  }
}

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
  {
    type: 'function',
    function: {
      name: 'listDocs',
      description:
        '列出知识库文档概况。用户问「有哪些文档」「知识库里有什么文件」「知识库里有多少个文件」时调用；不要用它代替正文检索。工具结果已截断：含总数，并按文件大小降序最多列出前 10 篇，其余用省略号表示。回答时只复述这些信息，不要臆造未列出的文件名，也不要要求用户查看完整清单。',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

/** listDocs 对外展示时，按大小最多列出前 N 篇 */
const LIST_DOCS_TOP_N = 10;

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

function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 列出知识库文档概况：总数 + 按大小前 N 篇，其余省略
 */
function runListDocs(): string {
  const docs = listDocs();
  if (!docs.length) return '知识库当前没有文档。\n总文档数：0';

  const sorted = [...docs].sort((a, b) => b.size - a.size);
  const top = sorted.slice(0, LIST_DOCS_TOP_N);
  const omitted = sorted.length - top.length;

  const lines = [
    `总文档数：${docs.length}`,
    `按文件大小前 ${top.length} 篇：`,
    ...top.map((d, i) => `${i + 1}. ${d.name}（${formatDocSize(d.size)}）`),
  ];
  if (omitted > 0) {
    lines.push(`…（其余 ${omitted} 篇省略）`);
  }
  return lines.join('\n');
}

type ToolExecOk = { ok: true; text: string; hits?: Citation[] };
type ToolExecFail = { ok: false; text: string; error: string };
type ToolExecResult = ToolExecOk | ToolExecFail;

/** 单工具最长执行时间（毫秒） */
const TOOL_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} 超时（>${ms}ms）`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function safeParseArgs(
  raw: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'arguments 必须是 JSON 对象' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, error: `arguments 不是合法 JSON: ${raw.slice(0, 120)}` };
  }
}

/** 给模型看的失败文案：明确失败，避免当成有效检索结果 */
function formatToolFailure(name: string, reason: string): string {
  return [
    `【工具失败】${name}`,
    `原因：${reason}`,
    '请不要编造知识库内容；向用户说明暂时无法完成该工具调用，并给出可重试建议。',
  ].join('\n');
}

/**
 * 执行单个 tool_call。
 * 任何失败都返回 ok:false + text，绝不向外抛（保证 Agent 循环与 SSE 可继续）。
 */
async function executeTool(t: FinalToolCall): Promise<ToolExecResult> {
  try {
    if (t.name === 'ragSearch') {
      const parsed = safeParseArgs(t.arguments);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error, text: formatToolFailure(t.name, parsed.error) };
      }
      const query = String(parsed.value.query ?? '').trim();
      if (!query) {
        const error = '缺少参数 query，或 query 为空';
        return { ok: false, error, text: formatToolFailure(t.name, error) };
      }

      const out = await withTimeout(runRagSearch(query), TOOL_TIMEOUT_MS, 'ragSearch');
      return { ok: true, text: out.text, hits: out.hits };
    }

    if (t.name === 'listDocs') {
      const text = await withTimeout(Promise.resolve(runListDocs()), TOOL_TIMEOUT_MS, 'listDocs');
      return { ok: true, text };
    }

    const error = `未知工具：${t.name}`;
    return { ok: false, error, text: formatToolFailure(t.name, error) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error, text: formatToolFailure(t.name, error) };
  }
}

/**
 * 消费一轮带 tools 的流：
 * - 若出现 tool_calls：不把碎片正文当最终答案
 * - 若无 tool_calls：把 content 推给前端
 *
 * 「模型决策 → 可选执行工具 → 再生成回答」
 *
 * @param res Response 对象
 * @param client OpenAI 客户端
 * @param modelName 模型名称
 * @param messages 消息
 * @param enableTools 是否启用工具
 * @returns 一轮对话的返回结果
 */
async function consumeToolRound(
  res: Response,
  client: ReturnType<typeof getLlmClient>,
  modelName: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  enableTools: boolean,
): Promise<RoundResult> {
  const stream = await client.chat.completions.create({
    model: modelName,
    messages,
    ...(enableTools ? { tools, tool_choice: 'auto' as const } : { tool_choice: 'none' as const }),
    stream: true,
  });

  // 工具调用Map，key为工具调用索引，value为工具调用对象
  const toolMap = new Map<number, ToolCallAcc & { arguments: string }>();
  /** 流式清洗器 */
  const sanitizer = new StreamContentSanitizer();
  let content = '';
  /** 是否看到工具调用 */
  let sawToolCall = false;
  /** 是否有内容 */
  let hasContent = false;

  const emitContent = (piece: string) => {
    if (!piece) return;
    content += piece;
    hasContent = true;
    writeSse(res, { content: piece });
    flushSse(res);
  };

  for await (const chunk of stream) {
    const chunkError = getStreamChunkError(chunk);
    if (chunkError) throw createHttpError(chunkError, 500);
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    /**
     * 流式响应：工具调用
     * 如果模型返回工具调用，则将工具调用添加到工具调用Map中
     * 并继续消费下一轮流式响应
     */
    if (enableTools && delta.tool_calls?.length) {
      sawToolCall = true;
      mergeToolCallDeltas(toolMap, delta.tool_calls);
      continue;
    }
    /**
     * 流式响应：模型返回回答
     * 如果模型返回回答，并且还没有看到工具调用，则将回答添加到回答中
     * 并流式返回给前端
     * 如果模型返回回答，并且已经看到工具调用，则不流式返回给前端
     */
    if (delta.content && !sawToolCall) {
      emitContent(sanitizer.push(delta.content));
    }
  }

  /** 工具调用 */
  const toolCalls = enableTools ? finalizeToolCalls(toolMap) : [];
  /** 如果工具调用不为空，则返回工具调用 */
  if (toolCalls.length > 0) {
    return { kind: 'tools', toolCalls, assistantContent: content };
  }
  /** 如果工具调用为空，则返回最终答案 */
  return { kind: 'final', hasContent };
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

  /** 所有引用 */
  let allCitations: Citation[] = [];

  for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await consumeToolRound(res, client, modelName, messages, true);

    // 模型直接回答，结束
    if (result.kind === 'final') {
      if (!result.hasContent) {
        writeSseError(res, '模型未返回任何内容，请检查模型是否支持 tools / API Key');
        return;
      }
      writeSseDone(res);
      return;
    }

    // 有工具调用
    const { toolCalls, assistantContent } = result;

    messages.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map((t) => ({
        id: t.id,
        type: 'function' as const,
        function: { name: t.name, arguments: t.arguments },
      })),
    });

    for (const t of toolCalls) {
      let args: Record<string, string> = {};
      try {
        const parsed = JSON.parse(t.arguments || '{}');
        if (t.name === 'ragSearch' && parsed.query) {
          args = { query: String(parsed.query) };
        }
      } catch { /* ignore */ }
      writeSse(res, { event: 'tool_start', name: t.name, round, args });
      flushSse(res);

      const out = await executeTool(t);

      if (!out.ok) {
        // 前端可提示失败；SSE 不断开
        writeSse(res, {
          event: 'tool_error',
          name: t.name,
          round,
          error: out.error,
        });
        flushSse(res);
      } else if (out.hits?.length) {
        // 多轮检索时合并引用（按 id 去重）
        const seen = new Set(allCitations.map((c) => c.id));
        for (const h of out.hits) {
          if (!seen.has(h.id)) {
            seen.add(h.id);
            allCitations.push(h);
          }
        }
      }

      // 成功/失败都回灌给模型（失败用 formatToolFailure 文案）
      messages.push({
        role: 'tool',
        tool_call_id: t.id,
        content: out.text,
      });

      writeSse(res, {
        event: 'tool_end',
        name: t.name,
        round,
        ok: out.ok,
        result: (() => {
          if (!out.ok) return out.error;
          if (t.name === 'ragSearch') {
            const hitCount = out.hits?.length ?? 0;
            return hitCount > 0 ? `检索到 ${hitCount} 个片段` : '未检索到相关片段';
          }
          if (t.name === 'listDocs') return '文档列表已获取';
          return '执行完成';
        })(),
      });
      flushSse(res);
    }

    // 本轮结束先推一版 citations（前端可覆盖更新）
    if (allCitations.length) {
      writeSse(res, {
        citations: allCitations.map((h) => ({
          id: h.id,
          source: h.source,
          text: h.text.length > 240 ? `${h.text.slice(0, 240)}…` : h.text,
          score: h.score,
        })),
      });
    }

    // 若这是最后一轮仍可能再喊工具：跳出循环做强制收尾
    if (round === MAX_TOOL_ROUNDS) break;
  }

  // ---------- 达到上限：禁止再调工具，强制最终回答 ----------
  writeSse(res, { event: 'tool_limit', maxRounds: MAX_TOOL_ROUNDS });
  flushSse(res);

  // 关键：明确禁止再调工具 / 禁止输出 DSML
  messages.push({
    role: 'user',
    content:
      '【系统约束】工具调用次数已达上限。禁止再调用任何工具；禁止输出 tool_calls、DSML、XML、函数调用或标签。请仅根据上文已有的工具结果，用简洁中文给出最终总结回答。',
  });
  const finale = await consumeToolRound(res, client, modelName, messages, false);
  if (finale.kind !== 'final' || !finale.hasContent) {
    writeSseError(res, '已达工具调用上限，且模型未给出最终回答');
    return;
  }
  writeSseDone(res);
}
