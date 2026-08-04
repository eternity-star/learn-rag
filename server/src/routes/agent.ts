import { Router } from 'express';
import type { ChatMessage } from '../types/chat.js';
import { agentStream } from '../services/agent.js';
import { getErrorMessage, getErrorStatus } from '../utils/errors.js';
import { writeSseError } from '../utils/sse.js';

const router = Router();

/**
 * Agent 流式对话（模型可选择调用 ragSearch）
 * POST /api/agent/stream
 * body: { messages: ChatMessage[], model?: string }
 */
router.post('/api/agent/stream', async (req, res) => {
  try {
    const messages = req.body?.messages as ChatMessage[] | undefined;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages 不能为空' });
      return;
    }
    const hasUser = messages.some((m) => m.role === 'user' && m.content?.trim());
    if (!hasUser) {
      res.status(400).json({ error: '缺少用户问题' });
      return;
    }
    await agentStream(res, messages, req.body?.model);
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
