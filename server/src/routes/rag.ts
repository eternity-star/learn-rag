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
import { Indexer } from '../services/indexer.js';

const router = Router();
const MIN_SCORE = 0.6; // 可按实测再调

router.post('/api/rag/stream', async (req, res) => {
  try {
    const messages = req.body?.messages as ChatMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const question = lastUser?.content?.trim();
    if (!question) {
      res.status(400).json({ error: '缺少用户问题' });
      return;
    }
    const hits = await retrieve(question, 3);
    const topScore = hits[0]?.score ?? 0;
    const relevantHits = hits.length > 0 && topScore >= MIN_SCORE ? hits : [];
    const hitsText = relevantHits.map((h, i) => `[${i + 1}] (${h.source}) ${h.text}`).join('\n\n');
    const ragSystemPrompt =
      relevantHits.length === 0
        ? `你是知识库助手。当前没有足够相关的参考资料，请直接回答「根据现有知识库，我不知道」或说明资料不足，不要编造。`
        : `你是知识库助手。只根据「参考资料」回答；资料不足就说不知道，不要编造。
参考资料未直接写明价格/下载地址/官网时，必须回答不知道，禁止猜测。
参考资料：
${hitsText}`;

    const clientSystem = messages.find((m) => m.role === 'system');
    const mergedSystem: ChatMessage = {
      role: 'system',
      content: clientSystem?.content
        ? `${clientSystem.content}\n\n${ragSystemPrompt}`
        : ragSystemPrompt,
    };

    const chatMessages: ChatMessage[] = [
      mergedSystem,
      ...messages.filter((m) => m.role !== 'system'),
    ];

    const model = req.body?.model as string | undefined;
    const stream = await chatCompletionStream(chatMessages, model);
    const iterator = stream[Symbol.asyncIterator]();

    // 关键：先读第一块。无效 Key / 上游 4xx 多数在这里抛错。
    const first = await iterator.next();

    initSseHeaders(res);

    // 先发引用，再发正文增量
    writeSseCitations(
      res,
      relevantHits.map((h) => ({
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

/**
 * 重建索引
 */
router.post('/api/rag/reindex', async (_req, res) => {
  try {
    const indexer = new Indexer();
    await indexer.build();
    indexer.save();
    res.json({
      ok: true,
      chunks: indexer.getChunks().length,
    });
  } catch (err) {
    console.error(err);
    const error = getErrorMessage(err);
    res.status(getErrorStatus(err)).json({ error });
  }
});

export default router;
