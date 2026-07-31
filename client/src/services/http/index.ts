import { createAxios } from './axios';
import { Request } from './constant';

export const http = createAxios({
  baseURL: '/api',
  timeout: Request.TIMEOUT as number,
  // 跨域时候允许携带凭证
  withCredentials: true,
});

export { getApiError } from './error';
export type { HttpRequestConfig, HttpResponse } from './types';
export { HttpError } from './types';
