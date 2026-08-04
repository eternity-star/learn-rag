import { Router } from 'express';
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} from '../services/conversations.js';
import { getErrorMessage, getErrorStatus } from '../utils/errors.js';

const router = Router();

/** 对话列表（不含 messages） */
router.get('/api/conversations/query', (_req, res) => {
  try {
    res.json({ conversations: listConversations() });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '列出对话失败') });
  }
});

/** 对话详情（含 messages）；须写在带 :id 的路由中，路径已含 get 前缀避免歧义 */
router.get('/api/conversations/get/:id', (req, res) => {
  try {
    res.json({ conversation: getConversation(req.params.id) });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '获取对话失败') });
  }
});

/** 新建对话 */
router.post('/api/conversations/create', (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
    res.json({ conversation: createConversation(title) });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '创建对话失败') });
  }
});

/** 更新标题 / 消息 */
router.post('/api/conversations/update/:id', (req, res) => {
  try {
    const conversation = updateConversation(req.params.id, {
      title: req.body?.title,
      messages: req.body?.messages,
    });
    res.json({ conversation });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '更新对话失败') });
  }
});

/** 删除对话 */
router.post('/api/conversations/delete/:id', (req, res) => {
  try {
    res.json({ ok: true, ...deleteConversation(req.params.id) });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '删除对话失败') });
  }
});

export default router;
