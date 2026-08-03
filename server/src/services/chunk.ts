import type { Chunk } from '../types/chunk.js';

type MdSection = {
  /** 标题面包屑，如 ["二、具体操作细节"] */
  headings: string[];
  /** 含本节标题行在内的正文 */
  content: string;
};

/** 匹配 Markdown 标题；标题文案不能为空 */
const HEADING_RE = /^(#{1,6})\s+(\S.*)$/;

/**
 * 按 Markdown 一级/二级标题（# / ##）切分。
 * ### 及以下保留在父节内，避免把「参数列表」和「参数说明」拆散导致检索变差。
 * 无有效标题时回退固定字数切分；单节过长再按 size/overlap 细分。
 */
export function chunkText(source: string, text: string, size = 1000, overlap = 100): Chunk[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const sections = splitByMarkdownHeadings(cleaned);

  if (sections.length === 0) {
    return chunkBySize(source, cleaned, size, overlap, docPrefix(source));
  }

  const chunks: Chunk[] = [];
  let index = 0;

  for (const section of sections) {
    const body = section.content.trim();
    if (!body) continue;

    const prefix = sectionPrefix(source, section.headings);

    if (body.length <= size) {
      chunks.push({
        id: `${source}#${index++}`,
        source,
        text: `${prefix}${body}`,
      });
      continue;
    }

    for (const piece of splitBySize(body, size, overlap)) {
      chunks.push({
        id: `${source}#${index++}`,
        source,
        text: `${prefix}${piece}`,
      });
    }
  }

  return chunks;
}

/**
 * 仅在 h1/h2 处切开；h3+ 当作正文。
 * 全文没有有效 h1/h2 时返回 []（走字数回退）。
 */
function splitByMarkdownHeadings(text: string): MdSection[] {
  const lines = text.split('\n');
  const sections: MdSection[] = [];
  const stack: { level: number; title: string }[] = [];
  let buf: string[] = [];
  let sawSplitHeading = false;

  const flush = () => {
    const content = buf.join('\n').trim();
    buf = [];
    if (!content) return;
    const nonEmpty = content.split('\n').filter((l) => l.trim());
    // 只有一行且是标题：无正文，不成段
    if (nonEmpty.length === 1 && HEADING_RE.test(nonEmpty[0]!)) return;
    sections.push({
      headings: stack.map((s) => s.title),
      content,
    });
  };

  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match) {
      const level = match[1]!.length;
      const title = match[2]!.trim();

      // 只把 # / ## 当作切分点；###+ 留在当前节
      if (level <= 2) {
        sawSplitHeading = true;
        flush();
        while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
          stack.pop();
        }
        stack.push({ level, title });
      }
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();

  return sawSplitHeading ? sections : [];
}

function docPrefix(source: string): string {
  return `文档：${source}\n\n`;
}

function sectionPrefix(source: string, headings: string[]): string {
  if (headings.length === 0) return docPrefix(source);
  return `文档：${source}\n章节：${headings.join(' > ')}\n\n`;
}

function chunkBySize(
  source: string,
  text: string,
  size: number,
  overlap: number,
  prefix: string,
): Chunk[] {
  const pieces = splitBySize(text, size, overlap);
  return pieces.map((piece, index) => ({
    id: `${source}#${index}`,
    source,
    text: `${prefix}${piece}`,
  }));
}

function splitBySize(text: string, size: number, overlap: number): string[] {
  const step = Math.max(1, size - overlap);
  const pieces: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const piece = text.slice(start, end).trim();
    if (piece) pieces.push(piece);
    if (end >= text.length) break;
    start += step;
  }

  return pieces;
}
