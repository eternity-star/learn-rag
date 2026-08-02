import MarkdownIt from 'markdown-it';

type RenderOptions = {
  /** 是否允许源文中的原始 HTML（本地知识库文档常用 HTML 表格） */
  allowHtml?: boolean;
};

/** 链接默认新窗口打开，并加 noopener 防反向控制 */
function enableExternalLinks(md: MarkdownIt) {
  const defaultRender =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const targetIdx = token.attrIndex('target');
    if (targetIdx < 0) {
      token.attrPush(['target', '_blank']);
    } else {
      token.attrs![targetIdx][1] = '_blank';
    }

    const relIdx = token.attrIndex('rel');
    if (relIdx < 0) {
      token.attrPush(['rel', 'noopener noreferrer']);
    } else {
      token.attrs![relIdx][1] = 'noopener noreferrer';
    }

    return defaultRender(tokens, idx, options, env, self);
  };
}

const mdSafe = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});
enableExternalLinks(mdSafe);

const mdWithHtml = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true,
});
enableExternalLinks(mdWithHtml);

/** Markdown 文本 → HTML */
export function renderMarkdown(source: string, options: RenderOptions = {}) {
  const { allowHtml = false } = options;
  return (allowHtml ? mdWithHtml : mdSafe).render(source || '');
}
