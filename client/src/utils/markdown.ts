import MarkdownIt from 'markdown-it';

type RenderOptions = {
  /** 是否允许源文中的原始 HTML（本地知识库文档常用 HTML 表格） */
  allowHtml?: boolean;
};

const mdSafe = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

const mdWithHtml = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true,
});

/** Markdown 文本 → HTML */
export function renderMarkdown(source: string, options: RenderOptions = {}) {
  const { allowHtml = false } = options;
  return (allowHtml ? mdWithHtml : mdSafe).render(source || '');
}
