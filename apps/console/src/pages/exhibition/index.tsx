import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useNavigate } from "react-router";
import type { FormInstance } from "antd/es/form";
import type { UploadFile, UploadProps } from "antd";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Cascader,
  Form,
  Modal,
  Radio,
  Space,
  Typography,
  Upload,
  message,
  theme,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HomeOutlined,
  PlusOutlined,
  SyncOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import {
  ModalForm,
  ProFormDateRangePicker,
  ProFormText,
  ProFormTextArea,
  ProFormTimePicker,
  ProTable,
} from "@ant-design/pro-components";
import type { Exhibition as ExhibitionTypes } from "@cr7/types";
import {
  createExhibitionApi,
  listExhibitionsApi,
  updateExhibitionApi,
  type CreateExhibitionInput,
} from "@/apis/exhibition";
import { uploadTopicImageApi } from "@/apis/topic";
import { useTableQuery } from "@/hooks/use-table-query";
import {
  useSyncExhibitionToDamai,
  useSyncExhibitionToMaoyan,
} from "@/hooks/use-sync";
import { formatDateTime, formatSessionDateTime } from "@/utils/format-datetime";
import {
  CHINA_REGION_CASCADER_OPTIONS,
  getCascaderValuePathByLeafCode,
  getRegionLabelByLeafCode,
} from "@/utils/china-region-cascader";
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "./exhibition.less";

dayjs.extend(customParseFormat);

/** OTA 同步目标（仅 UI，后续对接接口） */
type OtaPlatform = "ctrip" | "maoyan" | "damai";

type DayjsLike = {
  format: (fmt: string) => string;
};

function formatDayjsLike(value: unknown, fmt: string) {
  if (value && typeof value === "object" && "format" in value) {
    return (value as DayjsLike).format(fmt);
  }
  return value;
}

/** 新建弹窗表单：区间字段在提交时再拆成接口所需的独立字符串 */
type ExhibitionCreateFormValues = Omit<
  CreateExhibitionInput,
  "start_date" | "end_date" | "opening_time" | "closing_time" | "city"
> & {
  date_range?: [unknown, unknown] | null;
  session_time_range?: [unknown, unknown] | null;
  cover_url?: string;
  /** 省市区级联，提交时取末级六位码写入 city */
  city_cascader?: string[];
  venue_name: string;
};

const initialCreateValues: Partial<ExhibitionCreateFormValues> = {
  location: "",
  name: "",
  description: "",
  cover_url: "",
  venue_name: "",
};

type ExhibitionEditFormValues = {
  name: string;
  description: string;
  opening_time: Dayjs;
  closing_time: Dayjs;
  last_entry_time: Dayjs;
  city_cascader?: string[];
  venue_name: string;
  location: string;
  cover_url?: string;
};

function parseExhibitionTime(v: string | null | undefined): Dayjs {
  if (!v?.trim()) return dayjs("00:00:00", "HH:mm:ss");
  const s = v.trim();
  const strict = dayjs(s, "HH:mm:ss", true);
  if (strict.isValid()) return strict;
  const loose = dayjs(s, "HH:mm", true);
  if (loose.isValid()) return loose;
  const d = dayjs(s);
  return d.isValid() ? d : dayjs("00:00:00", "HH:mm:ss");
}

/** ProFormTimePicker 提交值可能是 Dayjs / string，统一为 HH:mm:ss */
function formatEditTimeField(v: unknown): string {
  if (v == null) return "";
  if (dayjs.isDayjs(v)) return v.format("HH:mm:ss");
  if (typeof v === "string") return parseExhibitionTime(v).format("HH:mm:ss");
  if (v instanceof Date) return dayjs(v).format("HH:mm:ss");
  return dayjs(v as string | number | Date).format("HH:mm:ss");
}

function buildExhibitionEditCoverUploadProps(
  form: FormInstance<ExhibitionEditFormValues>,
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
        const msg = err instanceof Error ? err.message : String(err);
        message.error(msg || "上传失败");
        onError?.(err as Error);
      } finally {
        setUploading(false);
      }
    },
  };
}

function buildExhibitionCoverUploadProps(
  form: FormInstance<ExhibitionCreateFormValues>,
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
        const msg = err instanceof Error ? err.message : String(err);
        message.error(msg || "上传失败");
        onError?.(err as Error);
      } finally {
        setUploading(false);
      }
    },
  };
}

const ExhibitionPage = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [createForm] = Form.useForm<ExhibitionCreateFormValues>();
  const [editForm] = Form.useForm<ExhibitionEditFormValues>();
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createCoverFiles, setCreateCoverFiles] = useState<UploadFile[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] =
    useState<ExhibitionTypes.Exhibition | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editCoverFiles, setEditCoverFiles] = useState<UploadFile[]>([]);
  const [editCoverUploading, setEditCoverUploading] = useState(false);
  const [otaSyncOpen, setOtaSyncOpen] = useState(false);
  const [otaSyncRow, setOtaSyncRow] =
    useState<ExhibitionTypes.Exhibition | null>(null);
  const [otaPlatform, setOtaPlatform] = useState<OtaPlatform>("maoyan");
  const { sync: syncToMaoyan, syncing: maoyanOtaSyncing } =
    useSyncExhibitionToMaoyan();
  const { sync: syncToDamai, syncing: damaiOtaSyncing } =
    useSyncExhibitionToDamai();
  const editingExhibitIdRef = useRef<string | null>(null);
  const { proTablePagination, rowIndexBase, getListParams } = useTableQuery({
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  const createCoverUploadProps = useMemo(
    () =>
      buildExhibitionCoverUploadProps(
        createForm,
        createCoverFiles,
        setCreateCoverFiles,
        coverUploading,
        setCoverUploading,
      ),
    [createForm, createCoverFiles, coverUploading],
  );

  const editCoverUploadProps = useMemo(
    () =>
      buildExhibitionEditCoverUploadProps(
        editForm,
        editCoverFiles,
        setEditCoverFiles,
        editCoverUploading,
        setEditCoverUploading,
      ),
    [editForm, editCoverFiles, editCoverUploading],
  );

  const openEditForRow = useCallback((row: ExhibitionTypes.Exhibition) => {
    editingExhibitIdRef.current = row.id;
    setEditingRow(row);
    setEditOpen(true);
  }, []);

  const openOtaSyncForRow = useCallback((row: ExhibitionTypes.Exhibition) => {
    setOtaSyncRow(row);
    setOtaPlatform("maoyan");
    setOtaSyncOpen(true);
  }, []);

  const closeOtaSyncModal = useCallback(() => {
    setOtaSyncOpen(false);
    setOtaSyncRow(null);
    setOtaPlatform("maoyan");
  }, []);

  const handleOtaSyncOk = useCallback(async () => {
    if (!otaSyncRow) return;
    const eid = otaSyncRow.id;
    if (otaPlatform === "ctrip") {
      message.warning("携程不支持从此处同步");
      return;
    }
    if (otaPlatform === "maoyan") {
      await syncToMaoyan(eid);
      return;
    }
    if (otaPlatform === "damai") {
      await syncToDamai(eid);
    }
  }, [otaSyncRow, otaPlatform, syncToMaoyan, syncToDamai]);

  /** 弹窗挂载后再写入表单，避免 setFieldsValue 早于 Form 渲染导致校验失败、保存无反应 */
  useEffect(() => {
    if (!editOpen || !editingRow) return;
    editForm.setFieldsValue({
      name: editingRow.name,
      description: editingRow.description,
      opening_time: parseExhibitionTime(
        editingRow.opening_time as string | null | undefined,
      ),
      closing_time: parseExhibitionTime(
        editingRow.closing_time as string | null | undefined,
      ),
      last_entry_time: parseExhibitionTime(
        editingRow.last_entry_time as string | null | undefined,
      ),
      city_cascader: getCascaderValuePathByLeafCode(editingRow.city) ?? [],
      venue_name: editingRow.venue_name ?? "",
      location: editingRow.location,
      cover_url: editingRow.cover_url ?? "",
    });
    setEditCoverFiles(
      editingRow.cover_url
        ? [
            {
              uid: "-cover",
              name: "cover",
              status: "done",
              url: editingRow.cover_url,
            },
          ]
        : [],
    );
  }, [editOpen, editingRow, editForm]);

  const columns = useMemo<ProColumns<ExhibitionTypes.Exhibition>[]>(
    () => [
      {
        title: "序号",
        width: 64,
        align: "center",
        search: false,
        render: (_, __, index) => rowIndexBase + index + 1,
      },
      {
        title: "展会名称",
        dataIndex: "name",
        ellipsis: true,
        width: 200,
      },
      {
        title: "内容预览",
        dataIndex: "description",
        ellipsis: true,
        search: false,
        width: 280,
        render: (_, row) => (
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: row.description }}
          >
            {row.description}
          </Typography.Text>
        ),
      },
      {
        title: "城市",
        dataIndex: "city",
        search: false,
        width: 220,
        ellipsis: true,
        render: (_, row) => (
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: getRegionLabelByLeafCode(row.city) }}
          >
            {getRegionLabelByLeafCode(row.city)}
          </Typography.Text>
        ),
      },
      {
        title: "场馆",
        dataIndex: "venue_name",
        search: false,
        width: 140,
        ellipsis: true,
        render: (t) => (
          <Typography.Text type="secondary">{t ?? "—"}</Typography.Text>
        ),
      },
      {
        title: "展期",
        search: false,
        width: 280,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatDateTime(row.start_date)} ~ {formatDateTime(row.end_date)}
          </Typography.Text>
        ),
      },
      {
        title: "开场 / 闭场",
        search: false,
        width: 280,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatSessionDateTime(row.start_date, row.opening_time)} —{" "}
            {formatSessionDateTime(row.start_date, row.closing_time)}
          </Typography.Text>
        ),
      },
      {
        title: "最晚入场",
        dataIndex: "last_entry_time",
        search: false,
        width: 150,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatSessionDateTime(row.start_date, row.last_entry_time)}
          </Typography.Text>
        ),
      },
      {
        title: "地点",
        dataIndex: "location",
        ellipsis: true,
        width: 160,
        render: (t) => <Typography.Text type="secondary">{t}</Typography.Text>,
      },
      // {
      //   title: "创建时间",
      //   dataIndex: "created_at",
      //   search: false,
      //   width: 170,
      //   render: (_, row) => (
      //     <Typography.Text type="secondary">
      //       {formatDateTime(row.created_at)}
      //     </Typography.Text>
      //   ),
      // },
      {
        title: "操作",
        key: "option",
        width: 200,
        fixed: "right",
        search: false,
        render: (_, row) => (
          <Space size="middle">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              style={{ padding: 0, height: "auto" }}
              onClick={() => navigate(`/exhibition/${row.id}`)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              style={{ padding: 0, height: "auto" }}
              onClick={() => openEditForRow(row)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              style={{ padding: 0, height: "auto" }}
              onClick={() => openOtaSyncForRow(row)}
            >
              同步到OTA
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ padding: 0, height: "auto" }}
              disabled
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [rowIndexBase, navigate, openEditForRow, openOtaSyncForRow],
  );

  async function handleCreateModalFinish(values: ExhibitionCreateFormValues) {
    const { date_range, session_time_range, city_cascader, ...rest } = values;
    if (!date_range?.[0] || !date_range?.[1]) {
      message.error("请选择展期");
      return false;
    }
    if (!session_time_range?.[0] || !session_time_range?.[1]) {
      message.error("请选择开闭场时间");
      return false;
    }
    const leaf =
      city_cascader && city_cascader.length > 0
        ? city_cascader[city_cascader.length - 1]
        : "";
    if (!leaf || !/^\d{6}$/.test(String(leaf))) {
      message.error("请选择完整的省 / 市 / 区（须选到区县）");
      return false;
    }
    const start_date = String(formatDayjsLike(date_range[0], "YYYY-MM-DD"));
    const end_date = String(formatDayjsLike(date_range[1], "YYYY-MM-DD"));
    const opening_time = String(
      formatDayjsLike(session_time_range[0], "HH:mm:ss"),
    );
    const closing_time = String(
      formatDayjsLike(session_time_range[1], "HH:mm:ss"),
    );
    const cover_url = rest.cover_url?.trim()
      ? rest.cover_url.trim()
      : undefined;
    return handleCreate({
      ...rest,
      city: String(leaf),
      cover_url,
      start_date,
      end_date,
      opening_time,
      closing_time,
    });
  }

  async function handleCreate(values: CreateExhibitionInput) {
    if (values.start_date > values.end_date) {
      message.error("开始日期不能晚于结束日期");
      return false;
    }
    if (values.opening_time > values.closing_time) {
      message.error("开场时间不能晚于闭场时间");
      return false;
    }
    if (values.last_entry_time > values.closing_time) {
      message.error("最晚入场时间不能晚于闭场时间");
      return false;
    }

    try {
      setSubmitting(true);
      await createExhibitionApi(values);
      message.success("展会创建成功");
      actionRef.current?.reload();
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      message.error(errMsg ? `展会创建失败：${errMsg}` : "展会创建失败");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditModalFinish(values: ExhibitionEditFormValues) {
    const eid = editingExhibitIdRef.current ?? editingRow?.id;
    if (!eid) {
      message.error("缺少展会 ID，请关闭后重试");
      return false;
    }
    try {
      setEditSubmitting(true);
      const leaf =
        values.city_cascader && values.city_cascader.length > 0
          ? values.city_cascader[values.city_cascader.length - 1]
          : "";
      if (!leaf || !/^\d{6}$/.test(String(leaf))) {
        message.error("请选择完整的省 / 市 / 区（须选到区县）");
        return false;
      }
      await updateExhibitionApi(eid, {
        name: values.name.trim(),
        description: values.description.trim(),
        opening_time: formatEditTimeField(values.opening_time),
        closing_time: formatEditTimeField(values.closing_time),
        last_entry_time: formatEditTimeField(values.last_entry_time),
        city: String(leaf),
        venue_name: values.venue_name.trim(),
        location: values.location.trim(),
        cover_url: values.cover_url?.trim() ? values.cover_url.trim() : null,
      });
      message.success("展会信息已更新");
      setEditOpen(false);
      setEditingRow(null);
      actionRef.current?.reload();
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      message.error(errMsg ? `更新失败：${errMsg}` : "更新失败");
      return false;
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <div className="exhibition-admin-page">
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
          { title: <span style={{ color: token.colorText }}>展会</span> },
        ]}
      />

      <Alert
        className="exhibition-config-alert"
        type="info"
        showIcon
        message="配置说明"
        description={
          <ol>
            <li>
              展览列表数据来自接口分页查询（limit / offset），每页最多 100 条。
            </li>
            <li>
              点击「新建展会」在弹窗中填写名称、描述、所在地区（省市区）、场馆名称、可选封面、展期、开闭场时间及地点后提交创建。
            </li>
            <li>
              展会基本信息（含封面、所在地区、场馆）可在列表行「编辑」弹窗中修改；展期仅在创建时设定。
            </li>
            <li>
              日期与时间字段需与后端约定格式一致（日期 YYYY-MM-DD，时间
              HH:mm:ss）。
            </li>
            <li>删除等操作需对接相应接口后开放；当前为占位交互。</li>
          </ol>
        }
        style={{
          marginBottom: token.marginMD,
          background: "#e6f7ff",
          border: "1px solid #91d5ff",
        }}
      />

      <Card
        className="exhibition-list-card"
        variant="borderless"
        title="展览列表"
        extra={
          <Space>
            {/* <Tooltip title="列表顺序由接口返回，暂无可保存的排序变更">
              <Button disabled>保存</Button>
            </Tooltip> */}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              新建展会
            </Button>
          </Space>
        }
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <ProTable<ExhibitionTypes.Exhibition>
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
            const { limit, offset } = getListParams(params, []);
            try {
              const res = await listExhibitionsApi({ limit, offset });
              return {
                data: res.data,
                success: true,
                total: res.total,
              };
            } catch (error) {
              const errMsg =
                error instanceof Error ? error.message : String(error);
              message.error(
                errMsg ? `加载失败：${errMsg}` : "加载展会列表失败",
              );
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </Card>

      <ModalForm<ExhibitionCreateFormValues>
        title="新建展会"
        form={createForm}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            setCreateCoverFiles([]);
          }
        }}
        initialValues={initialCreateValues}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        submitter={{
          searchConfig: {
            submitText: submitting ? "创建中…" : "创建",
          },
          resetButtonProps: { children: "重置" },
        }}
        onFinish={handleCreateModalFinish}
        width={640}
        layout="vertical"
      >
        <ProFormText
          name="name"
          label="展会名称"
          placeholder="请输入展会名称"
          rules={[{ required: true, message: "请输入展会名称" }]}
        />
        <ProFormTextArea
          name="description"
          label="展会描述"
          placeholder="请输入展会描述"
          rules={[{ required: true, message: "请输入展会描述" }]}
        />
        <Form.Item
          name="city_cascader"
          label="所在地区"
          rules={[{ required: true, message: "请选择省 / 市 / 区" }]}
        >
          <Cascader
            options={CHINA_REGION_CASCADER_OPTIONS}
            placeholder="请选择省 / 市 / 区（须选到区县）"
            showSearch={{
              filter: (inputValue, path) =>
                path.some((option) =>
                  String(option.label)
                    .toLowerCase()
                    .includes(inputValue.toLowerCase()),
                ),
            }}
            changeOnSelect={false}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <ProFormText
          name="venue_name"
          label="场馆名称"
          placeholder="请输入场馆名称"
          rules={[{ required: true, message: "请输入场馆名称" }]}
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
            上传封面（可选，限 1 张）
          </Typography.Text>
          <Upload {...createCoverUploadProps}>
            {createCoverFiles.length === 0 ? (
              <button type="button" style={{ border: 0, background: "none" }}>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>选择图片</div>
              </button>
            ) : null}
          </Upload>
        </div>
        <ProFormDateRangePicker
          name="date_range"
          label="展期"
          placeholder={["开始日期", "结束日期"]}
          fieldProps={{
            format: "YYYY-MM-DD",
            style: { width: "100%" },
          }}
          rules={[{ required: true, message: "请选择展期" }]}
        />
        <ProFormTimePicker.RangePicker
          name="session_time_range"
          label="开闭场时间"
          placeholder={["开场时间", "闭场时间"]}
          fieldProps={{
            format: "HH:mm:ss",
            style: { width: "100%" },
          }}
          rules={[{ required: true, message: "请选择开闭场时间" }]}
        />
        <ProFormTimePicker
          name="last_entry_time"
          label="最晚入场时间"
          placeholder="请选择最晚入场时间"
          fieldProps={{ format: "HH:mm:ss", style: { width: "100%" } }}
          transform={(value: unknown) => formatDayjsLike(value, "HH:mm:ss")}
          rules={[{ required: true, message: "请选择最晚入场时间" }]}
        />
        <ProFormText
          name="location"
          label="地点"
          placeholder="请输入地点"
          rules={[{ required: true, message: "请输入地点" }]}
        />
      </ModalForm>

      <ModalForm<ExhibitionEditFormValues>
        key={editingRow?.id ?? "edit-closed"}
        title="编辑展会信息"
        form={editForm}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            editingExhibitIdRef.current = null;
            setEditingRow(null);
            setEditCoverFiles([]);
            editForm.resetFields();
          }
        }}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        submitter={{
          searchConfig: {
            submitText: editSubmitting ? "保存中…" : "保存",
          },
          resetButtonProps: { children: "取消" },
        }}
        onFinish={handleEditModalFinish}
        onFinishFailed={({ errorFields }) => {
          const first = errorFields?.[0]?.errors?.[0];
          message.error(first ?? "请检查表单填写是否完整");
        }}
        width={640}
        layout="vertical"
        scrollToFirstError
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          展期（开始 / 结束日期）仅在创建展会时设定，此处不可修改。
        </Typography.Paragraph>
        <ProFormText
          name="name"
          label="展会名称"
          rules={[{ required: true, message: "请输入展会名称" }]}
        />
        <ProFormTextArea
          name="description"
          label="展会描述"
          rules={[{ required: true, message: "请输入展会描述" }]}
        />
        <ProFormTimePicker
          name="opening_time"
          label="开场时间"
          fieldProps={{ format: "HH:mm:ss", style: { width: "100%" } }}
          rules={[{ required: true, message: "请选择开场时间" }]}
        />
        <ProFormTimePicker
          name="closing_time"
          label="闭场时间"
          fieldProps={{ format: "HH:mm:ss", style: { width: "100%" } }}
          rules={[{ required: true, message: "请选择闭场时间" }]}
        />
        <ProFormTimePicker
          name="last_entry_time"
          label="最晚入场时间"
          fieldProps={{ format: "HH:mm:ss", style: { width: "100%" } }}
          rules={[{ required: true, message: "请选择最晚入场时间" }]}
        />
        <Form.Item
          name="city_cascader"
          label="所在地区"
          rules={[{ required: true, message: "请选择省 / 市 / 区" }]}
        >
          <Cascader
            options={CHINA_REGION_CASCADER_OPTIONS}
            placeholder="请选择省 / 市 / 区（须选到区县）"
            showSearch={{
              filter: (inputValue, path) =>
                path.some((option) =>
                  String(option.label)
                    .toLowerCase()
                    .includes(inputValue.toLowerCase()),
                ),
            }}
            changeOnSelect={false}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <ProFormText
          name="venue_name"
          label="场馆名称"
          placeholder="请输入场馆名称"
          rules={[{ required: true, message: "请输入场馆名称" }]}
        />
        <ProFormText
          name="location"
          label="地点"
          rules={[{ required: true, message: "请输入地点" }]}
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
            上传封面（限 1 张，删除可清空）
          </Typography.Text>
          <Upload {...editCoverUploadProps}>
            {editCoverFiles.length === 0 ? (
              <button type="button" style={{ border: 0, background: "none" }}>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>选择图片</div>
              </button>
            ) : null}
          </Upload>
        </div>
      </ModalForm>

      <Modal
        title="同步到 OTA"
        open={otaSyncOpen}
        onCancel={closeOtaSyncModal}
        onOk={handleOtaSyncOk}
        confirmLoading={maoyanOtaSyncing || damaiOtaSyncing}
        okText="确定同步"
        cancelText="取消"
        destroyOnClose
        maskClosable={false}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          当前展会：{otaSyncRow?.name ?? "—"}
        </Typography.Paragraph>
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginBottom: 8 }}
        >
          同步目标（单次仅可选一家）
        </Typography.Text>
        <Radio.Group
          value={otaPlatform}
          onChange={(e) => setOtaPlatform(e.target.value as OtaPlatform)}
        >
          <Space direction="vertical">
            <Radio value="maoyan">猫眼</Radio>
            <Radio value="damai">大麦</Radio>
            <Radio value="ctrip" disabled>
              携程（携程不支持，请移步携程后台处理）
            </Radio>
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  );
};

export default ExhibitionPage;
