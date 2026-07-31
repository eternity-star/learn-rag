import { HttpError } from './types';

/** 从 http 请求异常中取出可读错误文案 */
export function getApiError(err: unknown, fallback = '请求失败') {
  if (err instanceof HttpError) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || err.message || fallback;
  }
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } })
      .response;
    if (response?.data?.error) return response.data.error;
  }
  return err instanceof Error ? err.message : fallback;
}
