import { env, pipeline } from '@xenova/transformers';

// 国内访问 huggingface.co 常超时，可用镜像（如 https://hf-mirror.com）
if (process.env.HF_ENDPOINT) {
  env.remoteHost = process.env.HF_ENDPOINT.replace(/\/?$/, '/');
}

// 单例：模型只加载一次（第一次会下载，较慢）
let extractor: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      process.env.EMBEDDING_MODEL || 'Xenova/bge-small-zh-v1.5',
    );
  }
  return extractor;
}

/** 文本 → 向量 number[] */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true, // 归一化后可直接用点积当余弦相似度
  });
  // Transformers.js 返回的是 Tensor，转成普通数组
  return Array.from(output.data as Float32Array);
}
