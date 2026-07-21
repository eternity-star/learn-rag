/**
 * 从未知异常中提取可读错误文案（OpenAI SDK / 自建网关兼容）。
 */
export function getErrorMessage(err: unknown, fallback = '调用模型失败') {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as {
    status?: number;
    code?: string;
    message?: string;
    error?: { message?: string };
  };
  const detail = e.error?.message || e.message;
  if (e.status === 401 || e.code === 'invalid_api_key') {
    return detail || 'API Key 无效或未授权';
  }
  if (e.status === 429) {
    return detail || '请求过于频繁，请稍后重试';
  }
  return detail || fallback;
}

/** 提取 HTTP 状态码；非法时回落 500 */
export function getErrorStatus(err: unknown) {
  if (
    typeof err === 'object' &&
    err &&
    'status' in err &&
    typeof (err as { status?: number }).status === 'number'
  ) {
    const status = (err as { status: number }).status;
    if (status >= 400 && status < 600) return status;
  }
  return 500;
}

/** 构造带 status 的 Error，便于统一 getErrorStatus */
export function createHttpError(message: string, status = 500) {
  return Object.assign(new Error(message), { status });
}
