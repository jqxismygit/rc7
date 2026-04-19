/**
 * 文章正文 HTML 清洗，与 docs/api/topics.md 白名单及控制台 DOMPurify 配置对齐。
 */
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'video',
  'source',
  'blockquote',
  'hr',
  'pre',
  'code',
];

const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'style',
  'width',
  'height',
  'target',
  'rel',
  'controls',
  'poster',
  'preload',
  'muted',
  'playsinline',
  'type',
];

export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
