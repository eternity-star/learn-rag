import { Router } from 'express';
import { type ChatMessage } from '../services/deepseek.js';
import { chatCompletionStream } from '../services/deepseek.js';
import { createHttpError, getErrorMessage, getErrorStatus } from '../utils/errors.js';
import {
  getStreamChunkError,
  getStreamDelta,
  initSseHeaders,
  writeSseContent,
  writeSseDone,
  writeSseError,
  writeSseCitations,
} from '../utils/sse.js';
import { retrieve } from '../services/indexer.js';

const router = Router();

router.post('/api/rag/stream', async (req, res) => {
  try {
    const messages = req.body?.messages as ChatMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    const question = messages[messages.length - 1].content;
    const hits = await retrieve(question, 3);
    messages.unshift({
      role: 'system',
      content: `你是知识库助手。只根据「参考资料」回答；资料不足就说不知道，不要编造。
参考资料：
${hits.map((h, i) => `[${i + 1}] (${h.source}) ${h.text}`).join('\n\n')}`,
    });

    const stream = await chatCompletionStream(messages);
    const iterator = stream[Symbol.asyncIterator]();

    // 关键：先读第一块。无效 Key / 上游 4xx 多数在这里抛错。
    const first = await iterator.next();

    initSseHeaders(res);

    // 先发引用，再发正文增量
    writeSseCitations(
      res,
      hits.map((h) => ({
        id: h.id,
        source: h.source,
        text: h.text,
        score: h.score,
      })),
    );

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
