import { Drawer } from "antd";
import { useMemo } from "react";
import { buildArticlePreviewSrcDoc } from "@/utils/article-html";

export type ArticleMobilePreviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  html: string;
};

export function ArticleMobilePreviewDrawer({
  open,
  onClose,
  html,
}: ArticleMobilePreviewDrawerProps) {
  const srcDoc = useMemo(() => buildArticlePreviewSrcDoc(html), [html]);

  return (
    <Drawer
      title="移动端预览"
      placement="right"
      width={440}
      onClose={onClose}
      open={open}
      destroyOnClose
      styles={{ body: { paddingTop: 16 } }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: 375,
            border: "10px solid #1a1a1a",
            borderRadius: 28,
            overflow: "hidden",
            background: "#1a1a1a",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              height: 28,
              background: "#2a2a2a",
              borderRadius: "18px 18px 0 0",
            }}
          />
          <iframe
            title="article-mobile-preview"
            style={{
              width: 375,
              height: 620,
              border: 0,
              display: "block",
              background: "#fff",
            }}
            srcDoc={srcDoc}
            sandbox="allow-same-origin allow-popups"
          />
        </div>
      </div>
    </Drawer>
  );
}
