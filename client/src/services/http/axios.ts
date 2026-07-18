import type { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import axios from 'axios';

export class Axios<R> {
  private readonly instance: AxiosInstance;

  constructor(config?: R) {
    this.instance = axios.create({
      timeout: 30000,
      ...config,
    });

    this.instance.interceptors.request.use(
      config => {
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      },
    );

    this.instance.interceptors.response.use(
      response => {
        return response;
      },
      (error: AxiosError) => {
        const { response } = error;
        // 请求超时单独判断，因为请求超时没有 response
        if (error.message.indexOf('timeout') !== -1) {
          window.$message.error('请求超时！请您稍后重试');
        }
        return Promise.reject(error);
      },
    );
  }
}

export function createAxios<R>(config?: R) {
  return new Axios<R>(config);
}
