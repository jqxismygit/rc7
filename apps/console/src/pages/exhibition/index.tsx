import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Space,
  Typography,
  message,
  theme,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HomeOutlined,
  PlusOutlined,
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
  type CreateExhibitionInput,
} from "@/apis/exhibition";
import { useTableQuery } from "@/hooks/use-table-query";
import { formatDateTime, formatSessionDateTime } from "@/utils/format-datetime";
import "./exhibition.less";

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
  "start_date" | "end_date" | "opening_time" | "closing_time"
> & {
  date_range?: [unknown, unknown] | null;
  session_time_range?: [unknown, unknown] | null;
};

const initialCreateValues: Partial<ExhibitionCreateFormValues> = {
  location: "",
  name: "",
  description: "",
};

const ExhibitionPage = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { proTablePagination, rowIndexBase, getListParams } = useTableQuery({
    defaultPageSize: 10,
    maxPageSize: 100,
  });

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
      {
        title: "创建时间",
        dataIndex: "created_at",
        search: false,
        width: 170,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatDateTime(row.created_at)}
          </Typography.Text>
        ),
      },
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
              查看
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              style={{ padding: 0, height: "auto" }}
              disabled
            >
              编辑
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
    [rowIndexBase, navigate],
  );

  async function handleCreateModalFinish(values: ExhibitionCreateFormValues) {
    const { date_range, session_time_range, ...rest } = values;
    if (!date_range?.[0] || !date_range?.[1]) {
      message.error("请选择展期");
      return false;
    }
    if (!session_time_range?.[0] || !session_time_range?.[1]) {
      message.error("请选择开闭场时间");
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
    return handleCreate({
      ...rest,
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
              点击「新建展会」在弹窗中填写名称、描述、展期、开闭场时间及地点后提交创建。
            </li>
            <li>
              日期与时间字段需与后端约定格式一致（日期 YYYY-MM-DD，时间
              HH:mm:ss）。
            </li>
            <li>编辑、删除等操作需对接相应接口后开放；当前为占位交互。</li>
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
        open={createOpen}
        onOpenChange={setCreateOpen}
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
        width={560}
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
    </div>
  );
};

export default ExhibitionPage;
