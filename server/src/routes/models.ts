import { Router } from 'express';
import { getDefaultModel, listModels } from '../services/deepseek.js';
import { getErrorMessage, getErrorStatus } from '../utils/errors.js';

const router = Router();

/**
 * 查询可选模型列表（封装上游 GET {DEEPSEEK_BASE_URL}/models）
 */
router.get('/api/models', async (_req, res) => {
  try {
    const models = await listModels();
    res.json({
      models,
      defaultModel: getDefaultModel(),
    });
  } catch (err) {
    console.error(err);
    res.status(getErrorStatus(err)).json({
      error: getErrorMessage(err, '查询模型列表失败'),
    });
  }
});

export default router;
