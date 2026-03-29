import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link } from "react-router";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Form,
  Image,
  Modal,
  Space,
  Typography,
  Upload,
  message,
  theme,
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import {
  ModalForm,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from "@ant-design/pro-components";
import type { Topic as TopicTypes } from "@cr7/types";
import {
  createTopicApi,
  deleteTopicApi,
  listTopicsApi,
  updateTopicApi,
  uploadTopicImageApi,
} from "@/apis/topic";
import {
  normalizeProTablePaging,
  useTableQuery,
} from "@/hooks/use-table-query";
import { formatDateTime } from "@/utils/format-datetime";
import "./category.less";

type TopicRow = TopicTypes.TopicSummary;

type TopicFormValues = {
  title: string;
  description?: string;
  cover_url?: string;
};

function pickApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { message?: string } } })
      .response?.data;
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

const CategoryPage = () => {
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const [createForm] = Form.useForm<TopicFormValues>();
  const [editForm] = Form.useForm<TopicFormValues>();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TopicRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** 新建 / 编辑弹窗各仅允许 1 张封面，受控 fileList */
  const [createCoverFiles, setCreateCoverFiles] = useState<UploadFile[]>([]);
  const [editCoverFiles, setEditCoverFiles] = useState<UploadFile[]>([]);

  const { proTablePagination, rowIndexBase } = useTableQuery({
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  const columns = useMemo<ProColumns<TopicRow>[]>(
    () => [
      {
        title: "序号",
        width: 64,
        align: "center",
        search: false,
        render: (_, __, index) => rowIndexBase + index + 1,
      },
      {
        title: "封面",
        dataIndex: "cover_url",
        width: 88,
        search: false,
        render: (_, row) =>
          row.cover_url ? (
            <Image
              src={row.cover_url}
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
        title: "话题标题",
        dataIndex: "title",
        ellipsis: true,
        width: 200,
      },
      {
        title: "描述",
        dataIndex: "description",
        ellipsis: true,
        search: false,
        width: 260,
        render: (_, row) => (
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: row.description ?? undefined }}
          >
            {row.description ?? "—"}
          </Typography.Text>
        ),
      },
      {
        title: "文章数",
        dataIndex: "article_count",
        width: 88,
        align: "center",
        search: false,
      },
      {
        title: "操作",
        key: "option",
        width: 160,
        fixed: "right",
        search: false,
        render: (_, row) => (
          <Space size="middle">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              style={{ padding: 0, height: "auto" }}
              onClick={() => {
                setEditing(row);
                editForm.setFieldsValue({
                  title: row.title,
                  description: row.description ?? undefined,
                  cover_url: row.cover_url ?? undefined,
                });
                setEditCoverFiles(
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
                setEditOpen(true);
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
              onClick={() => confirmDelete(row)}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [rowIndexBase],
  );

  function confirmDelete(row: TopicRow) {
    Modal.confirm({
      title: "删除话题",
      content: `确定删除「${row.title}」？删除后将级联删除该话题下全部文章，且不可恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteTopicApi(row.id);
          message.success("已删除");
          actionRef.current?.reload();
        } catch (err) {
          message.error(pickApiErrorMessage(err) || "删除失败");
          throw err;
        }
      },
    });
  }

  const buildCoverUploadProps = (
    form: typeof createForm,
    fileList: UploadFile[],
    setFileList: Dispatch<SetStateAction<UploadFile[]>>,
  ): UploadProps => ({
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
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|webp)$/i.test(file.name);
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
  });

  async function submitCreate(values: TopicFormValues) {
    try {
      setSubmitting(true);
      await createTopicApi({
        title: values.title.trim(),
        description: values.description?.trim()
          ? values.description.trim()
          : undefined,
        cover_url: values.cover_url?.trim()
          ? values.cover_url.trim()
          : undefined,
      });
      message.success("话题创建成功");
      actionRef.current?.reload();
      return true;
    } catch (err) {
      message.error(pickApiErrorMessage(err) || "创建失败");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit(values: TopicFormValues) {
    if (!editing) return false;
    try {
      setSubmitting(true);
      await updateTopicApi(editing.id, {
        title: values.title.trim(),
        description: values.description?.trim()
          ? values.description.trim()
          : null,
        cover_url: values.cover_url?.trim() ? values.cover_url.trim() : null,
      });
      message.success("已保存");
      setEditOpen(false);
      setEditing(null);
      actionRef.current?.reload();
      return true;
    } catch (err) {
      message.error(pickApiErrorMessage(err) || "保存失败");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="category-admin-page">
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
            title: <span style={{ color: token.colorText }}>分类 / 话题</span>,
          },
        ]}
      />

      <Alert
        className="category-config-alert"
        type="info"
        showIcon
        message="配置说明"
        description={
          <ol>
            <li>话题列表来自接口分页（page / limit），每页最多 100 条。</li>
            <li>
              新建 /
              编辑时可填写标题、描述与封面；封面仅支持 1
              张图片（jpg/png/webp）。已有封面时仅可预览 / 删除；更换请先删除再上传，服务端会转为
              webp。
            </li>
            <li>删除话题会级联删除其下所有文章，请谨慎操作。</li>
          </ol>
        }
        style={{
          marginBottom: token.marginMD,
          background: "#e6f7ff",
          border: "1px solid #91d5ff",
        }}
      />

      <Card
        className="category-list-card"
        variant="borderless"
        title="话题列表"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建话题
          </Button>
        }
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <ProTable<TopicRow>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          scroll={{ x: "max-content" }}
          ghost
          cardProps={{ bodyStyle: { padding: 0 } }}
          options={false}
          search={false}
          pagination={proTablePagination}
          dateFormatter="string"
          headerTitle={false}
          toolBarRender={false}
          request={async (params) => {
            const paging = normalizeProTablePaging(params, {
              maxPageSize: 100,
            });
            try {
              const res = await listTopicsApi({
                page: paging.current,
                limit: paging.limit,
              });
              return {
                data: res.topics,
                success: true,
                total: res.total,
              };
            } catch (err) {
              message.error(pickApiErrorMessage(err) || "加载话题列表失败");
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </Card>

      <ModalForm<TopicFormValues>
        title="新建话题"
        form={createForm}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            setCreateCoverFiles([]);
          } else {
            createForm.resetFields();
            setCreateCoverFiles([]);
          }
        }}
        initialValues={{ title: "", description: "", cover_url: "" }}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        submitter={{
          searchConfig: {
            submitText: submitting ? "提交中…" : "创建",
          },
          resetButtonProps: { children: "重置" },
        }}
        onFinish={submitCreate}
        width={560}
        layout="vertical"
      >
        <ProFormText
          name="title"
          label="话题标题"
          placeholder="请输入标题"
          rules={[{ required: true, message: "请输入话题标题" }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="选填，可为空"
          fieldProps={{ rows: 3, showCount: true, maxLength: 2000 }}
        />
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
          <Upload
            {...buildCoverUploadProps(
              createForm,
              createCoverFiles,
              setCreateCoverFiles,
            )}
          >
            {createCoverFiles.length === 0 ? (
              <button type="button" style={{ border: 0, background: "none" }}>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>选择图片</div>
              </button>
            ) : null}
          </Upload>
        </div>
      </ModalForm>

      <ModalForm<TopicFormValues>
        title="编辑话题"
        form={editForm}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditing(null);
            editForm.resetFields();
            setEditCoverFiles([]);
          }
        }}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        submitter={{
          searchConfig: {
            submitText: submitting ? "保存中…" : "保存",
          },
          resetButtonProps: false,
        }}
        onFinish={submitEdit}
        width={560}
        layout="vertical"
      >
        <ProFormText
          name="title"
          label="话题标题"
          placeholder="请输入标题"
          rules={[{ required: true, message: "请输入话题标题" }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="选填，可为空"
          fieldProps={{ rows: 3, showCount: true, maxLength: 2000 }}
        />
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
          <Upload
            {...buildCoverUploadProps(editForm, editCoverFiles, setEditCoverFiles)}
          >
            {editCoverFiles.length === 0 ? (
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
};

export default CategoryPage;
