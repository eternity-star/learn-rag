import { Router } from 'express';
import { type ChatMessage } from '../services/deepseek.js';
import { chatCompletion, chatCompletionStream } from '../services/deepseek.js';

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
    res.status(500).json({ error: '调用模型失败' });
  }
});

/**
 * SSE流式聊天
 */
router.post('/api/chat/stream', async (req, res) => {
  try {
    const messages = req.body?.messages as ChatMessage[] | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 有些代理（如 nginx）默认会缓冲，这行可减少缓冲（本地也可写上）
    res.flushHeaders?.();

    const stream = await chatCompletionStream(messages);
    // 逐块读取模型输出
    for await (const chunk of stream) {
      // OpenAI 兼容协议：文字在 choices[0].delta.content
      const delta = chunk.choices[0]?.delta?.content;
      if (!delta) continue;
      // SSE 格式：一行 data: + JSON，再空一行
      res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
    }

    // 约定：发完用 [DONE] 标记结束（前端可据此停止）
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);

    // 若响应头还没发出去，可以正常返回 JSON 错误
    if (!res.headersSent) {
      res.status(500).json({ error: '调用模型失败' });
      return;
    }

    // 若已经开始流式输出，就写一条错误再结束
    res.write(`data: ${JSON.stringify({ error: '调用模型失败' })}\n\n`);
    res.end();
  }
});

export default router;
