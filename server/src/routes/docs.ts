import { Router } from 'express';
import { listDocs, saveDoc, deleteDoc } from '../services/docs.js';
import { getErrorMessage, getErrorStatus } from '../utils/errors.js';

const router = Router();

/**
 * 列出所有文档
 */
router.get('/api/rag/docs', (_req, res) => {
  try {
    res.json({ docs: listDocs() });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '列出文档失败') });
  }
});

/**
 * 保存文档
 */
router.post('/api/rag/docs', (req, res) => {
  try {
    const name = String(req.body?.name ?? '');
    const content = String(req.body?.content ?? '');
    if (!name || !content.trim()) {
      res.status(400).json({ error: 'name、content 不能为空' });
      return;
    }
    res.json({ ok: true, name: saveDoc(name, content) });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '保存文档失败') });
  }
});

/**
 * 删除文档
 */
router.delete('/api/rag/docs/:name', (req, res) => {
  try {
    res.json({ ok: true, name: deleteDoc(req.params.name) });
  } catch (err) {
    res.status(getErrorStatus(err)).json({ error: getErrorMessage(err, '删除文档失败') });
  }
});

export default router;
