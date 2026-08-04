/**
 * SSE 工具函数
 */

import type { Response } from 'express';
import type { RetrieveHit } from '../types/chunk.js';

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
  // 避免反向代理缓冲整段 SSE
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/** 尽快把已 write 的 SSE 帧刷给客户端（若存在 compression 等中间件） */
export function flushSse(res: Response) {
  const flushable = res as Response & { flush?: () => void };
  flushable.flush?.();
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

/** 写入 SSE 引用标记 */
export function writeSseCitations(res: Response, citations: Array<RetrieveHit>) {
  res.write(`data: ${JSON.stringify({ citations })}\n\n`);
}
