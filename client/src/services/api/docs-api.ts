import { http } from '../http';
import type { RagDocItem } from '@/types/docs';
import type { HttpResponse } from '../http/types';

/** 文档列表 */
export const fetchDocs = (): Promise<HttpResponse<{ docs: RagDocItem[] }>> => {
  return http.request({
    url: '/rag/docs',
    method: 'GET',
  });
};

/** 读取单个文档内容 */
export const fetchDocContent = (
  name: string,
): Promise<HttpResponse<{ name: string; content: string }>> => {
  return http.request({
    url: `/rag/docs/${encodeURIComponent(name)}`,
    method: 'GET',
  });
};

/** 上传 / 覆盖文档 */
export const uploadDoc = (
  name: string,
  content: string,
): Promise<HttpResponse<{ ok: boolean; name: string }>> => {
  return http.request({
    url: '/rag/docs',
    method: 'POST',
    data: { name, content },
  });
};

/** 删除文档 */
export const removeDoc = (
  name: string,
): Promise<HttpResponse<{ ok: boolean; name: string }>> => {
  return http.request({
    url: `/rag/docs/${encodeURIComponent(name)}`,
    method: 'DELETE',
  });
};

/** 重建索引（本地 embedding，可能较慢） */
export const reindexDocs = (): Promise<
  HttpResponse<{ ok: boolean; chunks: number }>
> => {
  return http.request({
    url: '/rag/reindex',
    method: 'POST',
    // 全量重建可能远超默认 10s
    timeout: 10 * 60 * 1000,
  });
};
