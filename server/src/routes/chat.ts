import { Router } from 'express';
import { type ChatMessage } from '../services/deepseek.js';
import { chatCompletion, chatCompletionStream } from '../services/deepseek.js';
import {
  createHttpError,
  getErrorMessage,
  getErrorStatus,
} from '../utils/errors.js';
import {
  getStreamChunkError,
  getStreamDelta,
  initSseHeaders,
  writeSseContent,
  writeSseDone,
  writeSseError,
} from '../utils/sse.js';

const router = Router();

/**
 * 非流式聊天
 */
router.post('/api/chat/index', async (req, res) => {
  try {
    const messages = req.body?.messages as ChatMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    const content = await chatCompletion(messages);
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err) });
  }
});

/**
 * SSE流式聊天
 *
 * 注意：OpenAI SDK 在 stream:true 时，`create()` 成功只代表「流对象创建成功」，
 * 鉴权/模型错误经常在第一次读取 chunk（iterator.next）时才抛出。
 * 因此必须先拉取第一块，再 flush SSE 响应头，否则前端永远看到 HTTP 200。
 */
router.post('/api/chat/stream', async (req, res) => {
  try {
    const messages = req.body?.messages as ChatMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    const stream = await chatCompletionStream(messages);
    const iterator = stream[Symbol.asyncIterator]();

    // 关键：先读第一块。无效 Key / 上游 4xx 多数在这里抛错。
    const first = await iterator.next();

    initSseHeaders(res);

    let hasContent = false;

    // 依赖本请求的 res / hasContent，留在路由闭包内，不要提到模块顶层
    const handleChunk = (chunk: unknown) => {
      const chunkError = getStreamChunkError(chunk);
      if (chunkError) {
        throw createHttpError(chunkError, 500);
      }
      const delta = getStreamDelta(chunk);
      if (!delta) return;
      hasContent = true;
      writeSseContent(res, delta);
    };

    if (!first.done) {
      handleChunk(first.value);
    }

    while (true) {
      const { done, value } = await iterator.next();
      if (done) break;
      handleChunk(value);
    }

    if (!hasContent) {
      // 上游给了“空成功流”（错误 Key 时部分网关会这样），对前端仍应视为失败
      writeSseError(res, '模型未返回任何内容，请检查 API Key / 模型配置后重试');
      return;
    }

    writeSseDone(res);
  } catch (err) {
    console.error(err);
    const error = getErrorMessage(err);

    if (!res.headersSent) {
      res.status(getErrorStatus(err)).json({ error });
      return;
    }

    writeSseError(res, error);
  }
});

export default router;
