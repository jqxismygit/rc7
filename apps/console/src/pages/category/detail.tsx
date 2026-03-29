import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ColumnsType } from "antd/es/table";
import type { FormInstance } from "antd/es/form";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Image,
  Modal,
  Space,
  Spin,
  Table,
  Typography,
  Upload,
  message,
  theme,
} from "antd";
import { ArticleInlineMiniPreview } from "@/components/article-inline-mini-preview/ArticleInlineMiniPreview";
import { ArticleRichEditor } from "@/components/article-rich-editor/ArticleRichEditor";
import type { UploadFile, UploadProps } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { ModalForm, ProFormText } from "@ant-design/pro-components";
import type { Topic as TopicTypes } from "@cr7/types";
import {
  createArticleApi,
  deleteArticleApi,
  getTopicDetailApi,
  updateArticleApi,
  uploadTopicImageApi,
} from "@/apis/topic";
import { formatDateTime } from "@/utils/format-datetime";
import { pickApiErrorMessage } from "@/utils/pick-api-error";
import {
  articleHtmlToPlainText,
  isArticleHtmlEmpty,
  sanitizeArticleHtml,
} from "@/utils/article-html";
import "./category.less";

type ArticleRow = TopicTypes.Article;

type ArticleFormValues = {
  title: string;
  content: string;
  cover_url?: string;
};

type ArticleEditorWithInlinePreviewProps = {
  value?: string;
  onChange?: (html: string) => void;
  editorKey: string;
  /** 模拟小程序导航栏标题，通常取表单「标题」 */
  navTitle?: string;
};

function ArticleEditorWithInlinePreview({
  value,
  onChange,
  editorKey,
  navTitle,
}: ArticleEditorWithInlinePreviewProps) {
  return (
    <div className="category-article-editor-split">
      <div className="category-article-editor-split__editor">
        <ArticleRichEditor
          editorKey={editorKey}
          height={480}
          value={value}
          onChange={onChange}
        />
      </div>
      <div className="category-article-editor-split__preview">
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginBottom: 8 }}
        >
          iPhone · 微信小程序（深色 rich-text）
        </Typography.Text>
        <ArticleInlineMiniPreview
          html={sanitizeArticleHtml(typeof value === "string" ? value : "")}
          navTitle={navTitle?.trim() || "文章预览"}
        />
      </div>
    </div>
  );
}

function buildArticleCoverUploadProps(
  form: FormInstance<ArticleFormValues>,
  fileList: UploadFile[],
  setFileList: Dispatch<SetStateAction<UploadFile[]>>,
  uploading: boolean,
  setUploading: Dispatch<SetStateAction<boolean>>,
): UploadProps {
  return {
  accept: "image/jpeg,image/jpg,image/png,image/webp",
  multiple: false,
  maxCount: 1,
  fileList,
  listType: "picture-card",
  className: "category-form-cover-upload",
  showUploadList: {
    showPreviewIcon: true,
    showRemoveIcon: true,
  },
  disabled: uploading,
  beforeUpload: (file) => {
    const ok =
      file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!ok) {
      message.error("仅支持 jpg / png / webp 图片");
      return Upload.LIST_IGNORE;
    }
    return true;
  },
  onChange: ({ fileList: fl }) => {
    setFileList(fl.length > 1 ? [fl[fl.length - 1]!] : fl);
  },
  onRemove: () => {
    form.setFieldValue("cover_url", "");
    setFileList([]);
    return true;
  },
  customRequest: async (options) => {
    const { file, onError, onSuccess } = options;
    try {
      setUploading(true);
      const rcFile = file as File & { uid?: string };
      const res = await uploadTopicImageApi(rcFile);
      form.setFieldValue("cover_url", res.url);
      message.success("上传成功");
      setFileList([
        {
          uid: String(rcFile.uid ?? `${Date.now()}`),
          name: rcFile.name || "cover",
          status: "done",
          url: res.url,
        },
      ]);
      onSuccess?.(res, new XMLHttpRequest());
    } catch (err) {
      message.error(pickApiErrorMessage(err) || "上传失败");
      onError?.(err as Error);
    } finally {
      setUploading(false);
    }
  },
};
}

export default function CategoryDetailPage() {
  const { tid = "" } = useParams<{ tid: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const [topic, setTopic] = useState<TopicTypes.TopicWithArticles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createArticleForm] = Form.useForm<ArticleFormValues>();
  const [editArticleForm] = Form.useForm<ArticleFormValues>();
  const [createArticleOpen, setCreateArticleOpen] = useState(false);
  const [editArticleOpen, setEditArticleOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<ArticleRow | null>(null);
  const [articleSubmitting, setArticleSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createArticleCoverFiles, setCreateArticleCoverFiles] = useState<
    UploadFile[]
  >([]);
  const [editArticleCoverFiles, setEditArticleCoverFiles] = useState<
    UploadFile[]
  >([]);
  const createTitleWatch = Form.useWatch("title", createArticleForm);
  const editTitleWatch = Form.useWatch("title", editArticleForm);

  const loadDetail = useCallback(async () => {
    if (!tid) {
      setLoading(false);
      setError("缺少话题 ID");
      setTopic(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getTopicDetailApi(tid);
      setTopic(res);
    } catch (err) {
      setError(pickApiErrorMessage(err) || "加载失败");
      setTopic(null);
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const confirmDeleteArticle = useCallback(
    (row: ArticleRow) => {
      Modal.confirm({
        title: "删除文章",
        content: `确定删除「${row.title}」？删除后不可恢复。`,
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        onOk: async () => {
          try {
            await deleteArticleApi(row.id);
            message.success("已删除");
            await loadDetail();
          } catch (err) {
            message.error(pickApiErrorMessage(err) || "删除失败");
            throw err;
          }
        },
      });
    },
    [loadDetail],
  );

  const articleColumns = useMemo<ColumnsType<ArticleRow>>(
    () => [
      {
        title: "序号",
        key: "index",
        width: 64,
        align: "center",
        render: (_, __, index) => index + 1,
      },
      {
        title: "封面",
        dataIndex: "cover_url",
        width: 88,
        render: (url: string | null) =>
          url ? (
            <Image
              src={url}
              alt=""
              width={56}
              height={56}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          ),
      },
      {
        title: "标题",
        dataIndex: "title",
        width: 200,
        ellipsis: true,
      },
      {
        title: "正文预览",
        dataIndex: "content",
        ellipsis: true,
        width: 320,
        render: (text: string) => {
          const plain = articleHtmlToPlainText(text, 160);
          return (
            <Typography.Text type="secondary" ellipsis={{ tooltip: plain }}>
              {plain || "—"}
            </Typography.Text>
          );
        },
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 170,
        render: (v: string) => (
          <Typography.Text type="secondary">{formatDateTime(v)}</Typography.Text>
        ),
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        width: 170,
        render: (v: string) => (
          <Typography.Text type="secondary">{formatDateTime(v)}</Typography.Text>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_, row) => (
          <Space size="middle">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              style={{ padding: 0, height: "auto" }}
              onClick={() => {
                setEditingArticle(row);
                editArticleForm.setFieldsValue({
                  title: row.title,
                  content: row.content,
                  cover_url: row.cover_url ?? undefined,
                });
                setEditArticleCoverFiles(
                  row.cover_url
                    ? [
                        {
                          uid: "-cover",
                          name: "cover",
                          status: "done",
                          url: row.cover_url,
                        },
                      ]
                    : [],
                );
                setEditArticleOpen(true);
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ padding: 0, height: "auto" }}
              onClick={() => confirmDeleteArticle(row)}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [confirmDeleteArticle, editArticleForm],
  );

  async function submitCreateArticle(values: ArticleFormValues) {
    if (!tid) return false;
    const content = sanitizeArticleHtml(values.content);
    if (isArticleHtmlEmpty(content)) {
      message.error("正文不能为空");
      return false;
    }
    try {
      setArticleSubmitting(true);
      await createArticleApi(tid, {
        title: values.title.trim(),
        content,
        cover_url: values.cover_url?.trim()
          ? values.cover_url.trim()
          : undefined,
      });
      message.success("文章创建成功");
      setCreateArticleOpen(false);
      createArticleForm.resetFields();
      setCreateArticleCoverFiles([]);
      await loadDetail();
      return true;
    } catch (err) {
      message.error(pickApiErrorMessage(err) || "创建失败");
      return false;
    } finally {
      setArticleSubmitting(false);
    }
  }

  async function submitEditArticle(values: ArticleFormValues) {
    if (!editingArticle) return false;
    const content = sanitizeArticleHtml(values.content);
    if (isArticleHtmlEmpty(content)) {
      message.error("正文不能为空");
      return false;
    }
    try {
      setArticleSubmitting(true);
      await updateArticleApi(editingArticle.id, {
        title: values.title.trim(),
        content,
        cover_url: values.cover_url?.trim() ? values.cover_url.trim() : null,
      });
      message.success("已保存");
      setEditArticleOpen(false);
      setEditingArticle(null);
      editArticleForm.resetFields();
      setEditArticleCoverFiles([]);
      await loadDetail();
      return true;
    } catch (err) {
      message.error(pickApiErrorMessage(err) || "保存失败");
      return false;
    } finally {
      setArticleSubmitting(false);
    }
  }

  const createUploadProps = buildArticleCoverUploadProps(
    createArticleForm,
    createArticleCoverFiles,
    setCreateArticleCoverFiles,
    uploading,
    setUploading,
  );
  const editUploadProps = buildArticleCoverUploadProps(
    editArticleForm,
    editArticleCoverFiles,
    setEditArticleCoverFiles,
    uploading,
    setUploading,
  );

  return (
    <div className="category-admin-page category-detail-page">
      <Breadcrumb
        style={{ marginBottom: token.marginMD }}
        items={[
          {
            title: (
              <Link to="/" style={{ color: token.colorTextSecondary }}>
                <HomeOutlined /> 首页
              </Link>
            ),
          },
          {
            title: (
              <Link
                to="/category"
                style={{ color: token.colorTextSecondary }}
              >
                分类
              </Link>
            ),
          },
          {
            title: (
              <span style={{ color: token.colorText }}>
                {topic?.title ?? "话题详情"}
              </span>
            ),
          },
        ]}
      />

      <Alert
        className="category-config-alert"
        type="info"
        showIcon
        message="说明"
        description={
          <ol>
            <li>话题信息来自「话题详情」接口；文章列表一并返回，表格为前端分页。</li>
            <li>
              文章标题必填；正文为富文本（HTML），弹窗右侧为 iPhone 框 + 小程序深色主题实时预览；封面可选，规则与话题封面一致（限
              1 张，先删再换）。
            </li>
            <li>
              小程序文章详情路径：
              <Typography.Text code>/pages/article-detail/article-detail?aid=文章ID</Typography.Text>
              （需在小程序内配置合法域名等）。
            </li>
          </ol>
        }
        style={{
          marginBottom: token.marginMD,
          background: "#e6f7ff",
          border: "1px solid #91d5ff",
        }}
      />

      <Card
        variant="borderless"
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : error ? (
          <Empty
            description={error}
            style={{ padding: 48 }}
          >
            <Button type="primary" onClick={() => navigate("/category")}>
              返回话题列表
            </Button>
          </Empty>
        ) : topic ? (
          <>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {topic.title}
            </Typography.Title>
            <Descriptions
              column={{ xs: 1, sm: 1, md: 2 }}
              bordered
              size="middle"
            >
              <Descriptions.Item label="话题 ID" span={2}>
                <Typography.Text copyable>{topic.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>
                {topic.title}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {topic.description ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="封面" span={2}>
                {topic.cover_url ? (
                  <Image
                    src={topic.cover_url}
                    alt=""
                    width={120}
                    height={120}
                    style={{ objectFit: "cover", borderRadius: 8 }}
                  />
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="文章数" span={2}>
                {topic.articles?.length ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(topic.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDateTime(topic.updated_at)}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="未找到话题" />
        )}
      </Card>

      {!loading && !error && topic ? (
        <Card
          className="category-detail-articles-card"
          variant="borderless"
          title="文章列表"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateArticleOpen(true)}
            >
              新建文章
            </Button>
          }
          style={{
            marginTop: token.marginMD,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          <Table<ArticleRow>
            className="category-detail-articles-table"
            rowKey="id"
            columns={articleColumns}
            dataSource={topic.articles ?? []}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              showTotal: (total) => `共 ${total} 篇`,
            }}
            locale={{ emptyText: "暂无文章，请点击「新建文章」" }}
            scroll={{ x: "max-content" }}
          />
        </Card>
      ) : null}

      <ModalForm<ArticleFormValues>
        title="新建文章"
        form={createArticleForm}
        open={createArticleOpen}
        onOpenChange={(open) => {
          setCreateArticleOpen(open);
          if (open) {
            setCreateArticleCoverFiles([]);
          } else {
            createArticleForm.resetFields();
            setCreateArticleCoverFiles([]);
          }
        }}
        initialValues={{ title: "", content: "<p><br></p>", cover_url: "" }}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
          zIndex: 1100,
          styles: {
            body: { maxHeight: "calc(100vh - 100px)", overflowY: "auto" },
          },
        }}
        submitter={{
          searchConfig: {
            submitText: articleSubmitting ? "提交中…" : "创建",
          },
          resetButtonProps: { children: "重置" },
        }}
        onFinish={submitCreateArticle}
        width={1200}
        layout="vertical"
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入文章标题"
          rules={[{ required: true, message: "请输入标题" }]}
        />
        <Form.Item
          name="content"
          label="正文（富文本）"
          rules={[
            { required: true, message: "请输入正文" },
            {
              validator: async (_, v) => {
                if (isArticleHtmlEmpty(typeof v === "string" ? v : "")) {
                  return Promise.reject(new Error("正文不能为空"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <ArticleEditorWithInlinePreview
            editorKey="create-article"
            navTitle={
              typeof createTitleWatch === "string" ? createTitleWatch : ""
            }
          />
        </Form.Item>
        <ProFormText
          name="cover_url"
          label="封面 URL"
          placeholder="上传后自动填入，或直接粘贴图片地址"
        />
        <div style={{ marginBottom: token.marginMD }}>
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 8 }}
          >
            上传封面（限 1 张）
          </Typography.Text>
          <Upload {...createUploadProps}>
            {createArticleCoverFiles.length === 0 ? (
              <button type="button" style={{ border: 0, background: "none" }}>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>选择图片</div>
              </button>
            ) : null}
          </Upload>
        </div>
      </ModalForm>

      <ModalForm<ArticleFormValues>
        title="编辑文章"
        form={editArticleForm}
        open={editArticleOpen}
        onOpenChange={(open) => {
          setEditArticleOpen(open);
          if (!open) {
            setEditingArticle(null);
            editArticleForm.resetFields();
            setEditArticleCoverFiles([]);
          }
        }}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
          zIndex: 1100,
          styles: {
            body: { maxHeight: "calc(100vh - 100px)", overflowY: "auto" },
          },
        }}
        submitter={{
          searchConfig: {
            submitText: articleSubmitting ? "保存中…" : "保存",
          },
          resetButtonProps: false,
        }}
        onFinish={submitEditArticle}
        width={1200}
        layout="vertical"
      >
        <ProFormText
          name="title"
          label="标题"
          placeholder="请输入文章标题"
          rules={[{ required: true, message: "请输入标题" }]}
        />
        <Form.Item
          name="content"
          label="正文（富文本）"
          rules={[
            { required: true, message: "请输入正文" },
            {
              validator: async (_, v) => {
                if (isArticleHtmlEmpty(typeof v === "string" ? v : "")) {
                  return Promise.reject(new Error("正文不能为空"));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <ArticleEditorWithInlinePreview
            editorKey={
              editingArticle ? `edit-article-${editingArticle.id}` : "edit-article"
            }
            navTitle={typeof editTitleWatch === "string" ? editTitleWatch : ""}
          />
        </Form.Item>
        <ProFormText
          name="cover_url"
          label="封面 URL"
          placeholder="上传后自动填入，或直接粘贴图片地址"
        />
        <div style={{ marginBottom: token.marginMD }}>
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 8 }}
          >
            上传封面（限 1 张）
          </Typography.Text>
          <Upload {...editUploadProps}>
            {editArticleCoverFiles.length === 0 ? (
              <button type="button" style={{ border: 0, background: "none" }}>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>选择图片</div>
              </button>
            ) : null}
          </Upload>
        </div>
      </ModalForm>

    </div>
  );
}
