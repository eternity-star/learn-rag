export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpRequestConfig = {
  url: string;
  method?: HttpMethod;
  data?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  params?: Record<string, string | number | boolean | undefined | null>;
};

export type HttpResponse<T = unknown> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: HttpRequestConfig;
};

export class HttpError extends Error {
  status?: number;
  response?: {
    data?: unknown;
    status?: number;
    statusText?: string;
  };

  constructor(
    message: string,
    options?: {
      status?: number;
      response?: HttpError['response'];
    },
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = options?.status;
    this.response = options?.response;
  }
}
