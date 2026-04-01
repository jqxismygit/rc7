import "@wangeditor/editor/dist/css/style.css";
import { useEffect, useMemo, useState } from "react";
import { Editor, Toolbar } from "@wangeditor/editor-for-react";
import type { IDomEditor, IEditorConfig, IToolbarConfig } from "@wangeditor/editor";
import { message } from "antd";
import { uploadTopicImageApi } from "@/apis/topic";
import { pickApiErrorMessage } from "@/utils/pick-api-error";

export type ArticleRichEditorProps = {
  value?: string;
  onChange?: (html: string) => void;
  disabled?: boolean;
  /** 编辑区高度（px） */
  height?: number;
  /** 切换实例时变更，避免不同文章间串内容 */
  editorKey?: string;
};

export function ArticleRichEditor({
  value = "",
  onChange,
  disabled,
  height = 360,
  editorKey = "article-editor",
}: ArticleRichEditorProps) {
  const [editor, setEditor] = useState<IDomEditor | null>(null);

  const editorConfig: Partial<IEditorConfig> = useMemo(
    () => ({
      placeholder: "请输入正文内容…",
      readOnly: disabled,
      MENU_CONF: {
        uploadImage: {
          maxFileSize: 10 * 1024 * 1024,
          allowedFileTypes: ["image/*"],
          async customUpload(
            file: File,
            insertFn: (url: string, alt: string, href: string) => void,
          ) {
            try {
              const res = await uploadTopicImageApi(file);
              insertFn(res.url, file.name || "image", res.url);
            } catch (e) {
              message.error(pickApiErrorMessage(e) || "图片上传失败");
            }
          },
        },
      },
    }),
    [disabled],
  );

  const toolbarConfig: Partial<IToolbarConfig> = useMemo(
    () => ({
      excludeKeys: [
        "group-video",
        "todo",
        "codeBlock",
        "insertTable",
        "fullScreen",
      ],
    }),
    [],
  );

  useEffect(() => {
    if (editor == null || editor.isDestroyed) return;
    const cur = editor.getHtml();
    if (value !== cur) {
      editor.setHtml(value || "<p><br></p>");
    }
  }, [value, editor]);

  return (
    <div
      style={{
        border: "1px solid #d9d9d9",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <Toolbar
        editor={editor}
        defaultConfig={toolbarConfig}
        mode="default"
        style={{ borderBottom: "1px solid #d9d9d9" }}
      />
      <Editor
        key={editorKey}
        defaultConfig={editorConfig}
        value={value}
        onCreated={setEditor}
        onChange={(ed) => onChange?.(ed.getHtml())}
        mode="default"
        style={{ height }}
      />
    </div>
  );
}
