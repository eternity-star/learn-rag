import type { HttpRequestConfig, HttpResponse } from './types';
import { HttpError } from './types';

type CreateAxiosOptions = {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  headers?: Record<string, string>;
};

function buildUrl(
  baseURL: string,
  url: string,
  params?: HttpRequestConfig['params'],
) {
  const path = url.startsWith('http')
    ? url
    : `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  const result = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      result.searchParams.set(key, String(value));
    });
  }
  // 同源相对路径更利于 Vite 代理
  return path.startsWith('http')
    ? result.toString()
    : `${result.pathname}${result.search}`;
}

export class Axios {
  private readonly defaults: CreateAxiosOptions;

  constructor(config: CreateAxiosOptions = {}) {
    this.defaults = {
      baseURL: '',
      timeout: 30000,
      withCredentials: false,
      headers: {},
      ...config,
    };
  }

  async request<T = unknown>(
    config: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    const method = (config.method || 'GET').toUpperCase() as NonNullable<
      HttpRequestConfig['method']
    >;
    const timeout = config.timeout ?? this.defaults.timeout ?? 30000;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      ...(this.defaults.headers || {}),
      ...(config.headers || {}),
    };

    let body: string | undefined;
    if (config.data !== undefined && method !== 'GET') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(config.data);
    }

    const requestUrl = buildUrl(
      this.defaults.baseURL || '',
      config.url,
      config.params,
    );

    try {
      const response = await fetch(requestUrl, {
        method,
        headers,
        body,
        credentials: this.defaults.withCredentials ? 'include' : 'same-origin',
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const message =
          typeof data === 'object' &&
          data &&
          'error' in data &&
          typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : `请求失败（${response.status}）`;
        throw new HttpError(message, {
          status: response.status,
          response: {
            data,
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      return {
        data: data as T,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config,
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        window.$message?.error?.('请求超时！请您稍后重试');
        throw new HttpError('请求超时！请您稍后重试');
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }
}

export function createAxios(config?: CreateAxiosOptions) {
  return new Axios(config);
}
