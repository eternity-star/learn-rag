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

    // 过长时优先按 ### 再切；短节也统一成 { headings, content }，避免类型不一致
    const pieces =
      body.length <= size
        ? [{ headings: section.headings, content: body }]
        : splitOversizedSection(body, section.headings, size, overlap);

    for (const piece of pieces) {
      const piecePrefix = sectionPrefix(source, piece.headings ?? section.headings);
      chunks.push({
        id: `${source}#${index++}`,
        source,
        text: `${piecePrefix}${piece.content}`,
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

/**
 * 超长 h2 节：先按 ### 切开；仍过长再字数切。
 * 返回带完整面包屑的子片。
 */
function splitOversizedSection(
  body: string,
  parentHeadings: string[],
  size: number,
  overlap: number,
): { headings: string[]; content: string }[] {
  const subSections = splitByHeadingLevel(body, 3);
  const out: { headings: string[]; content: string }[] = [];

  if (subSections.length <= 1) {
    for (const piece of splitBySize(body, size, overlap)) {
      out.push({ headings: parentHeadings, content: piece });
    }
    return out;
  }

  for (const sub of subSections) {
    const headings = [...parentHeadings, ...sub.headings];
    const content = sub.content.trim();
    if (!content) continue;
    if (content.length <= size) {
      out.push({ headings, content });
      continue;
    }
    for (const piece of splitBySize(content, size, overlap)) {
      out.push({ headings, content: piece });
    }
  }
  return out;
}

/** 按指定级别标题切开（如 level=3 只在 ### 处切） */
function splitByHeadingLevel(text: string, level: number): MdSection[] {
  const lines = text.split('\n');
  const sections: MdSection[] = [];
  let currentTitle = '';
  let buf: string[] = [];
  let saw = false;

  const flush = () => {
    const content = buf.join('\n').trim();
    buf = [];
    if (!content) return;
    sections.push({
      headings: currentTitle ? [currentTitle] : [],
      content,
    });
  };

  const re = new RegExp(`^(#{${level}})\\s+(\\S.*)$`);

  for (const line of lines) {
    const match = line.match(re);
    if (match) {
      saw = true;
      flush();
      currentTitle = match[2]!.trim();
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();
  return saw ? sections : [{ headings: [], content: text }];
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

/**
 * 全文按指定长度切分
 * @param text 文本
 * @param size 长度
 * @param overlap 重叠长度
 * @returns 切分后的文本数组
 */
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
