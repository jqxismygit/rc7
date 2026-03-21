import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ColumnsType } from "antd/es/table";
import {
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Spin,
  Table,
  Typography,
  message,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  HomeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  ModalForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
} from "@ant-design/pro-components";
import type { Exhibition as ExhibitionTypes } from "@cr7/types";
import type { Inventory as InventoryTypes } from "@cr7/types";
import {
  createExhibitionTicketCategoryApi,
  getExhibitionApi,
  listExhibitionSessionTicketsApi,
  updateTicketCategoryInventoryMaxApi,
  type CreateTicketCategoryInput,
} from "@/apis/exhibition";
import { formatDateTime, formatSessionDateTime } from "@/utils/format-datetime";
import dayjs from "dayjs";
import "./exhibition.less";

type ExhibitionDetailData = ExhibitionTypes.Exhibition & {
  sessions?: ExhibitionTypes.Session[];
  ticket_categories?: ExhibitionTypes.TicketCategory[];
};

const REFUND_POLICY_OPTIONS: {
  label: string;
  value: ExhibitionTypes.TicketCategory["refund_policy"];
}[] = [
  { label: "不可退票", value: "NON_REFUNDABLE" },
  { label: "开场前 48 小时可退", value: "REFUNDABLE_48H_BEFORE" },
];

function refundPolicyText(
  v: ExhibitionTypes.TicketCategory["refund_policy"],
): string {
  return REFUND_POLICY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

const ticketFormInitial: CreateTicketCategoryInput = {
  name: "",
  price: 0,
  valid_duration_days: 1,
  refund_policy: "NON_REFUNDABLE",
  admittance: 1,
};

export default function ExhibitionDetailPage() {
  const { eid = "" } = useParams<{ eid: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExhibitionDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  const [ticketInvModalOpen, setTicketInvModalOpen] = useState(false);
  const [ticketInvCategory, setTicketInvCategory] =
    useState<ExhibitionTypes.TicketCategory | null>(null);
  const [ticketInvSubmitting, setTicketInvSubmitting] = useState(false);

  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySession, setInventorySession] =
    useState<ExhibitionTypes.Session | null>(null);
  const [inventoryRows, setInventoryRows] = useState<
    InventoryTypes.SessionTicketsInventory[]
  >([]);

  const loadDetail = useCallback(async () => {
    if (!eid) {
      setLoading(false);
      setError("缺少展会 ID");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getExhibitionApi(eid);
      setData(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eid]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const openSessionInventory = useCallback(
    async (session: ExhibitionTypes.Session) => {
      if (!eid) return;
      setInventorySession(session);
      setInventoryModalOpen(true);
      setInventoryLoading(true);
      setInventoryRows([]);
      try {
        const rows = await listExhibitionSessionTicketsApi(eid, session.id);
        setInventoryRows(rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        message.error(msg ? `加载库存失败：${msg}` : "加载场次库存失败");
        setInventoryRows([]);
      } finally {
        setInventoryLoading(false);
      }
    },
    [eid],
  );

  const sessionColumns = useMemo<ColumnsType<ExhibitionTypes.Session>>(
    () => [
      {
        title: "序号",
        key: "index",
        width: 72,
        align: "center",
        render: (_, __, index) => index + 1,
      },
      {
        title: "场次日期",
        dataIndex: "session_date",
        width: 180,
        render: (v: string) => dayjs(v).format("YYYY-MM-DD"),
      },
      {
        title: "场次 ID",
        dataIndex: "id",
        ellipsis: true,
        render: (id: string) => (
          <Typography.Text copyable={{ text: id }} ellipsis>
            {id}
          </Typography.Text>
        ),
      },
      {
        title: "操作",
        key: "action",
        width: 108,
        fixed: "right",
        render: (_, row) => (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: "auto" }}
            onClick={() => void openSessionInventory(row)}
          >
            查看库存
          </Button>
        ),
      },
    ],
    [openSessionInventory],
  );

  const inventoryColumns = useMemo<
    ColumnsType<InventoryTypes.SessionTicketsInventory>
  >(
    () => [
      {
        title: "票种名称",
        dataIndex: "name",
        width: 140,
        ellipsis: true,
      },
      {
        title: "库存数量",
        dataIndex: "quantity",
        width: 100,
        render: (q: number) => (
          <Typography.Text strong>{q ?? 0}</Typography.Text>
        ),
      },
      {
        title: "价格（元）",
        dataIndex: "price",
        width: 100,
        render: (p: number) => (typeof p === "number" ? String(p) : p),
      },
      {
        title: "退票政策",
        dataIndex: "refund_policy",
        width: 180,
        render: (v: ExhibitionTypes.TicketCategory["refund_policy"]) =>
          refundPolicyText(v),
      },
      {
        title: "可入场人数",
        dataIndex: "admittance",
        width: 110,
      },
      // {
      //   title: "票种 ID",
      //   dataIndex: "id",
      //   ellipsis: true,
      //   render: (id: string) => (
      //     <Typography.Text copyable={{ text: id }} ellipsis>
      //       {id}
      //     </Typography.Text>
      //   ),
      // },
    ],
    [],
  );

  const openTicketInventoryModal = useCallback(
    (row: ExhibitionTypes.TicketCategory) => {
      setTicketInvCategory(row);
      setTicketInvModalOpen(true);
    },
    [],
  );

  const ticketColumns = useMemo<ColumnsType<ExhibitionTypes.TicketCategory>>(
    () => [
      {
        title: "序号",
        key: "index",
        width: 64,
        align: "center",
        render: (_, __, index) => index + 1,
      },
      {
        title: "票种名称",
        dataIndex: "name",
        width: 160,
        ellipsis: true,
      },
      {
        title: "价格（元）",
        dataIndex: "price",
        width: 110,
        render: (p: number) => (typeof p === "number" ? String(p) : p),
      },
      {
        title: "有效天数",
        dataIndex: "valid_duration_days",
        width: 96,
      },
      {
        title: "退票政策",
        dataIndex: "refund_policy",
        width: 200,
        render: (v: ExhibitionTypes.TicketCategory["refund_policy"]) =>
          refundPolicyText(v),
      },
      {
        title: "可入场人数",
        dataIndex: "admittance",
        width: 120,
      },
      {
        title: "票种 ID",
        dataIndex: "id",
        ellipsis: true,
        render: (id: string) => (
          <Typography.Text copyable={{ text: id }} ellipsis>
            {id}
          </Typography.Text>
        ),
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 170,
        render: (v: string) => formatDateTime(v),
      },
      {
        title: "操作",
        key: "ticketInventory",
        width: 120,
        fixed: "right",
        render: (_, row) => (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: "auto" }}
            onClick={() => openTicketInventoryModal(row)}
          >
            设置库存
          </Button>
        ),
      },
    ],
    [openTicketInventoryModal],
  );

  async function handleTicketModalFinish(values: CreateTicketCategoryInput) {
    if (!eid) return false;
    try {
      setTicketSubmitting(true);
      await createExhibitionTicketCategoryApi(eid, values);
      message.success("票种已添加");
      await loadDetail();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(msg ? `添加失败：${msg}` : "添加票种失败");
      return false;
    } finally {
      setTicketSubmitting(false);
    }
  }

  async function handleTicketInventoryFinish(values: { quantity: number }) {
    if (!eid || !ticketInvCategory) return false;
    try {
      setTicketInvSubmitting(true);
      await updateTicketCategoryInventoryMaxApi(
        eid,
        ticketInvCategory.id,
        values.quantity,
      );
      message.success("该票种在所有场次的库存上限已更新");
      setTicketInvModalOpen(false);
      setTicketInvCategory(null);
      await loadDetail();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(msg ? `更新失败：${msg}` : "更新库存失败");
      return false;
    } finally {
      setTicketInvSubmitting(false);
    }
  }

  return (
    <div className="exhibition-admin-page exhibition-detail-page">
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
                to="/exhibition"
                style={{ color: token.colorTextSecondary }}
              >
                展会
              </Link>
            ),
          },
          {
            title: (
              <span style={{ color: token.colorText }}>
                {data?.name ?? "展会详情"}
              </span>
            ),
          },
        ]}
      />

      <div style={{ marginBottom: token.marginMD }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/exhibition")}
          style={{ paddingLeft: 0 }}
        >
          返回列表
        </Button>
      </div>

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
          <Empty description={error} />
        ) : data ? (
          <>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {data.name}
            </Typography.Title>
            <Descriptions
              column={{ xs: 1, sm: 1, md: 2 }}
              bordered
              size="middle"
            >
              <Descriptions.Item label="展会 ID" span={2}>
                <Typography.Text copyable>{data.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="展会名称" span={2}>
                {data.name}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {data.description}
              </Descriptions.Item>
              <Descriptions.Item label="展期">
                {formatDateTime(data.start_date)} ~{" "}
                {formatDateTime(data.end_date)}
              </Descriptions.Item>
              <Descriptions.Item label="开场 / 闭场">
                {formatSessionDateTime(data.start_date, data.opening_time)} —{" "}
                {formatSessionDateTime(data.start_date, data.closing_time)}
              </Descriptions.Item>
              <Descriptions.Item label="最晚入场">
                {formatSessionDateTime(data.start_date, data.last_entry_time)}
              </Descriptions.Item>
              <Descriptions.Item label="地点">
                {data.location}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(data.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDateTime(data.updated_at)}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Empty description="未找到展会" />
        )}
      </Card>

      {!loading && !error && data ? (
        <>
          <Card
            className="exhibition-detail-tickets-card"
            variant="borderless"
            title="票种列表"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setTicketModalOpen(true)}
              >
                添加票种
              </Button>
            }
            style={{
              marginTop: token.marginMD,
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            <Table<ExhibitionTypes.TicketCategory>
              className="exhibition-detail-tickets-table"
              rowKey="id"
              columns={ticketColumns}
              dataSource={data.ticket_categories ?? []}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: (total) => `共 ${total} 种`,
              }}
              locale={{ emptyText: "暂无票种，请点击右上角「添加票种」" }}
              scroll={{ x: "max-content" }}
            />
          </Card>

          <Card
            className="exhibition-detail-sessions-card"
            variant="borderless"
            title="场次列表"
            style={{
              marginTop: token.marginMD,
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowSecondary,
            }}
          >
            <Table<ExhibitionTypes.Session>
              className="exhibition-detail-sessions-table"
              rowKey="id"
              columns={sessionColumns}
              dataSource={data.sessions ?? []}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total) => `共 ${total} 场`,
              }}
              locale={{ emptyText: "暂无场次数据" }}
              scroll={{ x: "max-content" }}
            />
          </Card>
        </>
      ) : null}

      <Modal
        title={
          inventorySession
            ? `场次库存 · ${dayjs(inventorySession.session_date).format("YYYY-MM-DD")}`
            : "场次库存"
        }
        open={inventoryModalOpen}
        onCancel={() => {
          setInventoryModalOpen(false);
          setInventorySession(null);
          setInventoryRows([]);
        }}
        footer={null}
        width={880}
        destroyOnClose
        maskClosable={false}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          展示该场次下各票种的库存数量（接口：GET
          /exhibition/:eid/sessions/:sid/tickets）。
        </Typography.Paragraph>
        <Spin spinning={inventoryLoading}>
          <Table<InventoryTypes.SessionTicketsInventory>
            rowKey="id"
            size="small"
            columns={inventoryColumns}
            dataSource={inventoryRows}
            pagination={false}
            locale={{
              emptyText: inventoryLoading ? "加载中…" : "暂无票种或库存数据",
            }}
            scroll={{ x: "max-content" }}
          />
        </Spin>
      </Modal>

      <ModalForm<{ quantity: number }>
        title={
          ticketInvCategory
            ? `设置库存 · ${ticketInvCategory.name}`
            : "设置库存"
        }
        open={ticketInvModalOpen}
        onOpenChange={(open) => {
          setTicketInvModalOpen(open);
          if (!open) setTicketInvCategory(null);
        }}
        initialValues={{ quantity: 0 }}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        submitter={{
          searchConfig: {
            submitText: ticketInvSubmitting ? "提交中…" : "确定",
          },
          resetButtonProps: { children: "取消" },
        }}
        onFinish={handleTicketInventoryFinish}
        width={480}
        layout="vertical"
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          将为本票种在<strong>全部场次</strong>下设置相同的库存上限数量（对应接口 PUT
          /exhibition/:eid/sessions/tickets/:tid/inventory/max）。
        </Typography.Paragraph>
        <ProFormDigit
          name="quantity"
          label="库存上限"
          placeholder="请输入数量"
          fieldProps={{ min: 0, precision: 0, style: { width: "100%" } }}
          rules={[{ required: true, message: "请输入库存上限" }]}
        />
      </ModalForm>

      <ModalForm<CreateTicketCategoryInput>
        title="添加票种"
        open={ticketModalOpen}
        onOpenChange={setTicketModalOpen}
        initialValues={ticketFormInitial}
        modalProps={{
          destroyOnClose: true,
          maskClosable: false,
        }}
        submitter={{
          searchConfig: {
            submitText: ticketSubmitting ? "提交中…" : "确定",
          },
          resetButtonProps: { children: "取消" },
        }}
        onFinish={handleTicketModalFinish}
        width={520}
        layout="vertical"
      >
        <ProFormText
          name="name"
          label="票种名称"
          placeholder="请输入票种名称"
          rules={[{ required: true, message: "请输入票种名称" }]}
        />
        <ProFormDigit
          name="price"
          label="价格（元）"
          placeholder="0"
          fieldProps={{ min: 0, precision: 0, style: { width: "100%" } }}
          rules={[{ required: true, message: "请输入价格" }]}
        />
        <ProFormDigit
          name="valid_duration_days"
          label="有效天数"
          placeholder="1"
          fieldProps={{ min: 1, precision: 0, style: { width: "100%" } }}
          rules={[{ required: true, message: "请输入有效天数" }]}
        />
        <ProFormSelect
          name="refund_policy"
          label="退票政策"
          options={REFUND_POLICY_OPTIONS}
          rules={[{ required: true, message: "请选择退票政策" }]}
        />
        <ProFormDigit
          name="admittance"
          label="可入场人数"
          placeholder="1"
          fieldProps={{ min: 1, precision: 0, style: { width: "100%" } }}
          rules={[{ required: true, message: "请输入可入场人数" }]}
        />
      </ModalForm>
    </div>
  );
}
