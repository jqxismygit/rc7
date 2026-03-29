import { useMemo } from "react";
import { buildArticleMiniProgramPreviewSrcDoc } from "@/utils/article-html";

export type ArticleInlineMiniPreviewProps = {
  /** 当前富文本 HTML（未净化也可，内部会 sanitize） */
  html: string;
  /** 模拟小程序导航栏标题，默认可为「预览」 */
  navTitle?: string;
};

/**
 * 控制台内嵌：iPhone 外框 + 仿小程序顶栏 + iframe 小程序风正文预览
 */
export function ArticleInlineMiniPreview({
  html,
  navTitle = "文章预览",
}: ArticleInlineMiniPreviewProps) {
  const srcDoc = useMemo(
    () => buildArticleMiniProgramPreviewSrcDoc(html),
    [html],
  );

  const title =
    navTitle && navTitle.trim() ? navTitle.trim().slice(0, 18) : "文章预览";

  return (
    <div className="article-inline-mini-preview">
      <div className="article-inline-mini-preview__phone">
        <div className="article-inline-mini-preview__bezel">
          <div className="article-inline-mini-preview__notch" aria-hidden />
          <div className="article-inline-mini-preview__statusbar">
            <span className="article-inline-mini-preview__time">9:41</span>
            <span className="article-inline-mini-preview__signals">
              <span className="article-inline-mini-preview__signal-bars" />
              <span className="article-inline-mini-preview__battery" />
            </span>
          </div>
          <div className="article-inline-mini-preview__mp-nav">
            <span className="article-inline-mini-preview__mp-nav-title">
              {title}
            </span>
          </div>
          <iframe
            title="mini-program-article-preview"
            className="article-inline-mini-preview__iframe"
            srcDoc={srcDoc}
            sandbox="allow-same-origin allow-popups"
          />
        </div>
      </div>
      <div className="article-inline-mini-preview__caption">
        微信小程序 · rich-text 深色主题预览
      </div>
    </div>
  );
}
