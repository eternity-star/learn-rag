export type Chunk = {
  id: string;
  source: string; // 文件名，如 "rag简介.md"
  text: string;
};

/**
 * 按固定字数切分文本
 * @param source 来源文件名
 * @param text 整篇正文
 * @param size 每段最多多少字（中文按字符数即可）
 * @param overlap 下一段往回重叠多少字
 * @returns 切好的片段数组
 */
export function chunkText(
  source: string,
  text: string,
  size = 400,
  overlap = 50,
): Chunk[] {
  /**
   * 为什么需要overlap？
   * 把一篇长文切成多段，相邻段有一点重叠，避免句子被拦腰切断后检索丢上下文。
   */

  // 1. 去掉首尾空白；统一换行，避免奇怪空白
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  // 2. 防御：重叠不能大于等于 size，否则会死循环
  const step = Math.max(1, size - overlap);

  const chunks: Chunk[] = [];
  let start = 0; // 当前切片的起始位置
  let index = 0; // 片段序号，从 1 开始

  // 3. 滑动窗口往前切
  while (start < cleaned.length) {
    const end = Math.min(start + size, cleaned.length);
    const piece = cleaned.slice(start, end).trim();

    if (piece) {
      chunks.push({
        // id 要唯一：文件名 + 序号
        id: `${source}#${index}`,
        source,
        text: piece,
      });
      index++;
    }

    // 已经到文末就结束
    if (end >= cleaned.length) break;

    // 下一段起点 = 当前起点 + 步长（size - overlap）
    start += step;
  }

  return chunks;
}
