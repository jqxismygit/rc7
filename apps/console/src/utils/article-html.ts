/**
 * 文章正文 HTML 清洗与预览壳，白名单与 docs/api/topics.md、服务端 article-html 一致。
 */
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "blockquote",
  "hr",
  "pre",
  "code",
];

const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "class",
  "style",
  "width",
  "height",
  "target",
  "rel",
];

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

/** 是否无有效正文（空段落、仅 br 等视为空） */
export function isArticleHtmlEmpty(html: string | undefined | null): boolean {
  if (html == null || html.trim() === "") return true;
  const textOnly = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
  return textOnly.replace(/\u00a0/g, " ").trim() === "";
}

/** 供表格等展示的纯文本摘要 */
export function articleHtmlToPlainText(html: string, maxLen = 120): string {
  const plain = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] })
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}

/** iframe 移动端预览文档（相对资源可走 /api） */
export function buildArticlePreviewSrcDoc(html: string): string {
  const safe = sanitizeArticleHtml(html);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const baseHref = origin ? `${origin}/api` : "";
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>${
    baseHref ? `<base href="${baseHref}/"/>` : ""
  }<style>
body{margin:0;padding:16px;font-size:16px;line-height:1.65;color:#1a1a1a;word-break:break-word;background:#fff;}
img{max-width:100%;height:auto;vertical-align:middle;}
p{margin:0 0 12px;}
h1,h2,h3{margin:16px 0 8px;font-weight:600;}
ul,ol{padding-left:1.25em;margin:0 0 12px;}
a{color:#1677ff;}
</style></head><body>${safe}</body></html>`;
}
