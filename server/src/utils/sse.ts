import type { Response } from 'express';

/** 写入一条 SSE 错误事件并结束响应 */
export function writeSseError(res: Response, error: string) {
  res.write(`data: ${JSON.stringify({ error })}\n\n`);
  res.end();
}

/** 写入一条 SSE 文本增量 */
export function writeSseContent(res: Response, content: string) {
  res.write(`data: ${JSON.stringify({ content })}\n\n`);
}

/** 写入 SSE 结束标记并结束响应 */
export function writeSseDone(res: Response) {
  res.write('data: [DONE]\n\n');
  res.end();
}

/** 设置 SSE 常用响应头并立即发送 */
export function initSseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

type StreamChunk = {
  error?: { message?: string } | string;
  choices?: Array<{ delta?: { content?: string } }>;
};

/** 解析流式 chunk 中的业务错误（部分网关不抛异常，只在 chunk 里带 error） */
export function getStreamChunkError(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null;
  const error = (chunk as StreamChunk).error;
  if (!error) return null;
  if (typeof error === 'string') return error;
  return error.message || '调用模型失败';
}

/** 解析 OpenAI 兼容协议的文本增量 */
export function getStreamDelta(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null;
  return (chunk as StreamChunk).choices?.[0]?.delta?.content || null;
}
