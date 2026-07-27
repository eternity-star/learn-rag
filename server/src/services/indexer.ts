import fs from 'node:fs';
import path from 'node:path';
import { chunkText } from './chunk.ts';
import { embedText } from './embedding.ts';

export type IndexedChunk = {
  id: string;
  source: string;
  text: string;
  embedding: number[];
};

export type RetrieveHit = {
  id: string;
  source: string;
  text: string;
  score: number;
};

export class Indexer {
  private docsDir: string = path.resolve(import.meta.dirname, '../../data/docs');
  private indexFilePath: string = path.resolve(import.meta.dirname, '../../data/chunks.json');
  private chunks: IndexedChunk[] = [];

  constructor() {}

  async build() {
    const files: string[] = fs.readdirSync(this.docsDir).filter((f) => f.endsWith('.md'));
    this.chunks = [];
    for (const file of files) {
      const fullPath = path.resolve(this.docsDir, file);
      // 读文件成字符串
      const content = fs.readFileSync(fullPath, 'utf-8');
      const chunkedTexts = chunkText(file, content);
      console.log(`indexed ${file}: ${chunkedTexts.length} chunks`);
      for (const chunkedText of chunkedTexts) {
        const embedding = await embedText(chunkedText.text);
        this.chunks.push({ ...chunkedText, embedding });
      }
      console.log(`total: ${this.chunks.length}`);
    }
  }
  save() {
    // 确保索引文件所在目录存在：取 chunks.json 的父目录，不存在则递归创建
    fs.mkdirSync(path.dirname(this.indexFilePath), { recursive: true });
    fs.writeFileSync(this.indexFilePath, JSON.stringify(this.chunks, null, 2));
  }
  load() {
    if (!fs.existsSync(this.indexFilePath)) {
      console.log('[ "index file not found" ] >', 'index file not found');
      return;
    }
    const content = fs.readFileSync(this.indexFilePath, 'utf-8');
    this.chunks = JSON.parse(content);
  }
  getChunks() {
    return this.chunks;
  }
}

// 用于计算向量相似度
function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i]! * b[i]!;
  }
  return s;
}

/**
 * 检索相似的文档片段
 * @param query 查询语句
 * @param topK 返回的相似文档片段数量
 * @returns 检索到的文档片段，按相似度从高到低排序
 */
export async function retrieve(query: string, topK: number = 5): Promise<RetrieveHit[]> {
  const indexer = new Indexer();
  indexer.load();
  const chunks = indexer.getChunks();
  if (chunks.length === 0) return [];
  const questionEmbedding = await embedText(query);
  const scored = chunks.map((chunk) => ({
    id: chunk.id,
    source: chunk.source,
    text: chunk.text,
    score: dot(questionEmbedding, chunk.embedding),
  }));

  // 分数从高到低排，取前 topK
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
