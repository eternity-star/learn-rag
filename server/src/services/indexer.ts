/**
 * 索引器
 * 将文档分块并嵌入向量，存储到 chunks.json 文件中
 * 从 chunks.json 文件中加载索引数据
 * 计算查询语句与索引数据的相似度
 * 返回相似度最高的文档片段
 *
 * 使用方法：
 * const indexer = new Indexer();
 * indexer.build();
 * const hits = indexer.retrieve('查询语句');
 * console.log(hits);
 */

import fs from 'node:fs';
import path from 'node:path';
import { chunkText } from './chunk.ts';
import { embedText } from './embedding.ts';
import type { IndexedChunk, RetrieveHit } from '../types/chunk.js';
import { getDocsDir } from './docs.ts';

export class Indexer {
  private docsDir: string = getDocsDir();
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
        // 向量用清洗后文本（去图片链接），展示仍保留原文
        const embedding = await embedText(toEmbedText(chunkedText.text));
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

/** 去掉 markdown 图片，减少噪声对 embedding 的干扰 */
function toEmbedText(text: string): string {
  return text
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 从问题里抽关键词，用来匹配 source 文件名 */
function extractQueryTokens(query: string): string[] {
  const q = query.toLowerCase();
  // 连续英文/数字（pacs、iho、lis…）；过短易误伤（如 ho 命中大量文件名）
  const latin = (q.match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter((t) => t.length >= 3);
  const extras: string[] = [];
  if (q.includes('影像')) extras.push('pacs');
  if (q.includes('采集卡')) extras.push('采集卡');
  if (q.includes('电生理')) extras.push('电生理');
  return [...new Set([...latin, ...extras])];
}

/** 抽问题里的中文/英文词，用于正文关键词加分（简易 hybrid） */
function extractTextTerms(query: string): string[] {
  const quoted = [...query.matchAll(/[「"']([^」"']{2,20})[」"']/g)].map((m) => m[1]!);
  const cjkRuns = query.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const cjk: string[] = [...quoted];

  for (const run of cjkRuns) {
    cjk.push(run);
    // 长串（如「配置仪器资源时要配哪」）再切 4~8 字窗口，才能命中正文里的「配置仪器资源」
    if (run.length > 6) {
      for (let len = 8; len >= 4; len--) {
        for (let i = 0; i + len <= run.length; i++) {
          cjk.push(run.slice(i, i + len));
        }
      }
    }
  }

  const latin = query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  return [...new Set([...cjk, ...latin])].sort((a, b) => b.length - a.length);
}

function calcSourceBoost(source: string, tokens: string[]): number {
  const s = source.toLowerCase();
  // 命中任意 keywords 就加分；多个命中可累加，设上限避免爆表
  let boost = 0;
  tokens.forEach((t) => {
    const key = t.toLowerCase();
    if (key.length >= 2 && s.includes(key)) boost += 0.08;
  });
  return Math.min(boost, 0.2);
}

/**
 * 正文命中问题关键词则加分。
 * 解决：正确答案片段语义分偏低（约 0.47），被无关文档压过。
 */
function calcTextBoost(chunkText: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const text = chunkText.toLowerCase();
  let boost = 0;
  const matched: string[] = [];

  for (const term of terms) {
    const key = term.toLowerCase();
    if (key.length < 2) continue;
    // 已被更长命中词覆盖则跳过（如已命中「配置仪器资源」则不再计「配置」）
    if (matched.some((m) => m.includes(key))) continue;
    if (!text.includes(key)) continue;
    matched.push(key);
    // 词越长越能区分文档，加分越多
    boost += Math.min(0.025 * key.length, 0.14);
  }

  return Math.min(boost, 0.35);
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
  const tokens = extractQueryTokens(query);
  const textTerms = extractTextTerms(query);
  const scored = chunks.map((chunk) => {
    const semantic = dot(questionEmbedding, chunk.embedding);
    const sourceBoost = calcSourceBoost(chunk.source, tokens);
    const textBoost = calcTextBoost(chunk.text, textTerms);
    const score = semantic + sourceBoost + textBoost;
    return {
      id: chunk.id,
      source: chunk.source,
      text: chunk.text,
      score,
    };
  });

  // 分数从高到低排，取前 topK
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
