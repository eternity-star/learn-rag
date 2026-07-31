declare module 'markdown-it' {
  interface MarkdownItOptions {
    html?: boolean;
    linkify?: boolean;
    breaks?: boolean;
    typographer?: boolean;
  }

  export default class MarkdownIt {
    constructor(options?: MarkdownItOptions);
    render(src: string): string;
  }
}
