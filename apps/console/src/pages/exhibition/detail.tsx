import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { ColumnsType } from "antd/es/table";
import {
  Breadcrumb,
  Button,
  Calendar,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Image,
  Modal,
  Radio,
  Segmented,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
  message,
  theme,
} from "antd";
import {
  HomeOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SyncOutlined,
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
import { useModal } from "@/hooks/use-modal";
import { useSyncInfoToDamai, useSyncInfoToMaoyan } from "@/hooks/use-sync";
import { formatDateTime } from "@/utils/format-datetime";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import "./exhibition.less";

type ExhibitionDetailData = ExhibitionTypes.Exhibition & {
  sessions?: ExhibitionTypes.Session[];
  ticket_categories?: ExhibitionTypes.TicketCategory[];
};

/** 同步到 OTA 弹窗：平台与同步项 */
type OtaSyncPlatform = "maoyan" | "damai" | "ctrip";
type OtaSyncScope = "sessions" | "tickets" | "price" | "inventory";

/** 猫眼 / 大麦：固定同步项展示（不可编辑，仅说明实际同步范围与顺序） */
type OtaFixedSyncPlatform = "maoyan" | "damai";

const OTA_SYNC_FIXED_CONTENT: Record<
  OtaFixedSyncPlatform,
  {
    rows: { label: string; checked: boolean }[];
    hint: string;
  }
> = {
  maoyan: {
    rows: [
      { label: "场次", checked: true },
      { label: "票种", checked: true },
      { label: "价格", checked: true },
      { label: "库存", checked: true },
    ],
    hint: "猫眼将按固定顺序同步：票种（含价格）→ 场次 → 库存",
  },
  damai: {
    rows: [
      { label: "场次", checked: true },
      { label: "票种", checked: true },
      { label: "价格", checked: false },
      { label: "库存", checked: false },
    ],
    hint: "大麦仅同步场次与票种（票种同步含价格）；以下均为固定项，不可更改",
  },
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

function formatClockText(input: string | null | undefined): string {
  if (!input?.trim()) return "—";
  const s = input.trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (m) {
    return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
  }
  const d = dayjs(s);
  if (d.isValid()) return d.format("HH:mm");
  return s;
}

function formatDateOnlyText(input: string | Date | null | undefined): string {
  if (input == null || input === "") return "—";
  const d = dayjs(input);
  return d.isValid() ? d.format("YYYY-MM-DD") : String(input);
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
  const { sync: syncInfoToMaoyan, syncing: maoyanInfoSyncing } =
    useSyncInfoToMaoyan();
  const { sync: syncInfoToDamai, syncing: damaiInfoSyncing } =
    useSyncInfoToDamai();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExhibitionDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    visible: addTicketVisible,
    open: openAddTicketModal,
    close: closeAddTicketModal,
  } = useModal();

  const {
    visible: ticketInvVisible,
    data: ticketInvData,
    open: openTicketInvModal,
    close: closeTicketInvModal,
  } = useModal<ExhibitionTypes.TicketCategory>();

  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketInvSubmitting, setTicketInvSubmitting] = useState(false);
  const [sessionInvLoading, setSessionInvLoading] = useState(false);
  const [sessionInvRows, setSessionInvRows] = useState<
    InventoryTypes.SessionTicketsInventory[]
  >([]);

  const [selectedDay, setSelectedDay] = useState<Dayjs | null>(null);
  const [panelDate, setPanelDate] = useState<Dayjs>(() => dayjs());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const [otaSyncModalOpen, setOtaSyncModalOpen] = useState(false);
  const [otaSyncPlatform, setOtaSyncPlatform] =
    useState<OtaSyncPlatform>("maoyan");
  const [otaSyncScopes, setOtaSyncScopes] = useState<OtaSyncScope[]>([]);
  const [otaSyncDateRange, setOtaSyncDateRange] = useState<
    [Dayjs, Dayjs] | null
  >(null);

  const otaExhibitionDateBounds = useMemo(() => {
    if (!data?.start_date || !data?.end_date) return null;
    const start = dayjs(data.start_date).startOf("day");
    const end = dayjs(data.end_date).startOf("day");
    if (!start.isValid() || !end.isValid()) return null;
    return { start, end };
  }, [data?.start_date, data?.end_date]);

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

  /** 当前选中场次变更时拉取该场次库存 */
  useEffect(() => {
    if (!eid || !selectedSessionId) {
      setSessionInvRows([]);
      setSessionInvLoading(false);
      return;
    }
    let cancelled = false;
    setSessionInvLoading(true);
    setSessionInvRows([]);
    (async () => {
      try {
        const rows = await listExhibitionSessionTicketsApi(
          eid,
          selectedSessionId,
        );
        if (!cancelled) setSessionInvRows(rows);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          message.error(msg ? `加载库存失败：${msg}` : "加载场次库存失败");
          setSessionInvRows([]);
        }
      } finally {
        if (!cancelled) setSessionInvLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eid, selectedSessionId, data]);

  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, ExhibitionTypes.Session[]>();
    for (const s of sessions) {
      const key = dayjs(s.session_date).format("YYYY-MM-DD");
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
      );
    }
    return map;
  }, [sessions]);

  useLayoutEffect(() => {
    if (!sessions.length) {
      setSelectedDay(null);
      setSelectedSessionId(null);
      return;
    }
    setSelectedSessionId((prev) => {
      if (prev && sessions.some((s) => s.id === prev)) return prev;
      return sessions[0].id;
    });
  }, [sessions]);

  useLayoutEffect(() => {
    if (!selectedSessionId) return;
    const s = sessions.find((x) => x.id === selectedSessionId);
    if (s) {
      const d = dayjs(s.session_date);
      setSelectedDay(d);
      setPanelDate(d);
    }
  }, [selectedSessionId, sessions]);

  const selectedSession = useMemo(
    () =>
      selectedSessionId
        ? sessions.find((s) => s.id === selectedSessionId)
        : undefined,
    [sessions, selectedSessionId],
  );

  const sessionsOnSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    return sessionsByDate.get(selectedDay.format("YYYY-MM-DD")) ?? [];
  }, [selectedDay, sessionsByDate]);

  /** 展期与场次并集，避免场次落在展期外时无法在日历中选到 */
  const exhibitionDateRange = useMemo((): [Dayjs, Dayjs] | undefined => {
    if (!data) return undefined;
    let start = data.start_date ? dayjs(data.start_date).startOf("day") : null;
    let end = data.end_date ? dayjs(data.end_date).endOf("day") : null;
    for (const s of sessions) {
      const d = dayjs(s.session_date);
      if (!d.isValid()) continue;
      const dayStart = d.startOf("day");
      const dayEnd = d.endOf("day");
      if (!start || dayStart.isBefore(start)) start = dayStart;
      if (!end || dayEnd.isAfter(end)) end = dayEnd;
    }
    if (start && end && start.isValid() && end.isValid()) return [start, end];
    return undefined;
  }, [data, sessions]);

  const handleCalendarSelect = useCallback(
    (date: Dayjs) => {
      setSelectedDay(date);
      setPanelDate(date);
      const key = date.format("YYYY-MM-DD");
      const list = sessionsByDate.get(key);
      if (list?.length) setSelectedSessionId(list[0].id);
      else setSelectedSessionId(null);
    },
    [sessionsByDate],
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
      openTicketInvModal(row);
    },
    [openTicketInvModal],
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
        render: (p: number) => (typeof p === "number" ? String(p * 0.01) : p),
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
      await createExhibitionTicketCategoryApi(eid, {
        ...values,
        price: values.price * 100,
      });
      message.success("票种已添加");
      closeAddTicketModal();
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
    const category = ticketInvData;
    if (!eid || !category) return false;
    try {
      setTicketInvSubmitting(true);
      await updateTicketCategoryInventoryMaxApi(
        eid,
        category.id,
        values.quantity,
      );
      message.success("该票种在所有场次的库存上限已更新");
      closeTicketInvModal();
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

      {/* <div style={{ marginBottom: token.marginMD }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/exhibition")}
          style={{ paddingLeft: 0 }}
        >
          返回列表
        </Button>
      </div> */}

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
            <div
              style={{
                display: "flex",
                gap: token.marginSM,
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: token.marginMD,
              }}
            >
              <Typography.Title
                level={4}
                style={{ marginTop: 0, marginBottom: 0 }}
              >
                {data.name}
              </Typography.Title>
              <Button
                type="primary"
                icon={<SyncOutlined />}
                onClick={() => {
                  setOtaSyncModalOpen(true);
                  setOtaSyncPlatform("maoyan");
                  setOtaSyncScopes([]);
                  if (data?.start_date && data?.end_date) {
                    setOtaSyncDateRange([
                      dayjs(data.start_date).startOf("day"),
                      dayjs(data.end_date).startOf("day"),
                    ]);
                  } else {
                    setOtaSyncDateRange(null);
                  }
                }}
              >
                批量同步到OTA
              </Button>
            </div>
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
              <Descriptions.Item label="封面" span={2}>
                {data.cover_url ? (
                  <div style={{ maxWidth: 360 }}>
                    <Image
                      src={data.cover_url}
                      alt=""
                      preview={{ mask: "预览" }}
                      style={{
                        width: "100%",
                        height: "auto",
                        maxHeight: 320,
                        objectFit: "contain",
                        verticalAlign: "top",
                        borderRadius: 8,
                        display: "block",
                      }}
                    />
                  </div>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="展期">
                {formatDateOnlyText(data.start_date)} ~{" "}
                {formatDateOnlyText(data.end_date)}
              </Descriptions.Item>
              <Descriptions.Item label="开场 / 闭场">
                {formatClockText(data.opening_time)} —{" "}
                {formatClockText(data.closing_time)}
              </Descriptions.Item>
              <Descriptions.Item label="最晚入场">
                {formatClockText(data.last_entry_time)}
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
              <div style={{ display: "flex", gap: token.marginSM }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => openAddTicketModal()}
                >
                  添加票种
                </Button>
              </div>
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
            {sessions.length === 0 ? (
              <Empty description="暂无场次数据" />
            ) : (
              <Flex
                gap={token.marginLG}
                align="flex-start"
                wrap="wrap"
                className="exhibition-detail-sessions-layout"
              >
                <div className="exhibition-detail-session-calendar-wrap">
                  <Calendar
                    fullscreen={false}
                    value={selectedDay ?? panelDate}
                    validRange={exhibitionDateRange}
                    onSelect={(d) => handleCalendarSelect(d)}
                    onPanelChange={(d) => setPanelDate(d)}
                    cellRender={(current, info) => {
                      if (info.type !== "date") return info.originNode;
                      const hasSession =
                        (sessionsByDate.get(current.format("YYYY-MM-DD"))
                          ?.length ?? 0) > 0;
                      if (!hasSession) return null;
                      return (
                        <span
                          className="exhibition-session-calendar-has-session"
                          aria-hidden
                        />
                      );
                    }}
                  />
                </div>
                <div
                  className="exhibition-detail-session-panel"
                  style={{ flex: "1 1 320px", minWidth: 280 }}
                >
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    当前场次
                  </Typography.Title>
                  {selectedSession ? (
                    <>
                      {sessionsOnSelectedDay.length > 1 ? (
                        <div style={{ marginBottom: token.marginMD }}>
                          <Typography.Text
                            type="secondary"
                            style={{ display: "block", marginBottom: 8 }}
                          >
                            当日有多场，请切换：
                          </Typography.Text>
                          <Segmented
                            value={selectedSessionId ?? undefined}
                            onChange={(v) => setSelectedSessionId(v as string)}
                            options={sessionsOnSelectedDay.map((s, i) => ({
                              label: `第 ${i + 1} 场`,
                              value: s.id,
                            }))}
                          />
                        </div>
                      ) : null}
                      <Descriptions
                        bordered
                        column={1}
                        size="middle"
                        className="exhibition-detail-session-descriptions"
                      >
                        <Descriptions.Item label="场次日期">
                          {dayjs(selectedSession.session_date).format(
                            "YYYY-MM-DD",
                          )}
                        </Descriptions.Item>
                        <Descriptions.Item label="场次 ID">
                          <Typography.Text
                            copyable={{ text: selectedSession.id }}
                          >
                            {selectedSession.id}
                          </Typography.Text>
                        </Descriptions.Item>
                      </Descriptions>
                      <Typography.Title
                        level={5}
                        style={{ marginTop: token.marginLG, marginBottom: 12 }}
                      >
                        库存
                      </Typography.Title>
                      <Spin spinning={sessionInvLoading}>
                        <Table<InventoryTypes.SessionTicketsInventory>
                          className="exhibition-detail-session-inventory-table"
                          rowKey="id"
                          size="small"
                          columns={inventoryColumns}
                          dataSource={sessionInvRows}
                          pagination={false}
                          locale={{
                            emptyText: sessionInvLoading
                              ? "加载中…"
                              : "暂无票种或库存数据",
                          }}
                          scroll={{ x: "max-content" }}
                        />
                      </Spin>
                    </>
                  ) : selectedDay && sessionsOnSelectedDay.length === 0 ? (
                    <Empty description="该日暂无场次" />
                  ) : (
                    <Empty description="请在左侧日历中选择有场次的日期" />
                  )}
                </div>
              </Flex>
            )}
          </Card>
        </>
      ) : null}

      <Modal
        title="同步场次到 OTA"
        width={640}
        open={otaSyncModalOpen}
        onCancel={() => setOtaSyncModalOpen(false)}
        confirmLoading={
          (otaSyncPlatform === "maoyan" && maoyanInfoSyncing) ||
          (otaSyncPlatform === "damai" && damaiInfoSyncing)
        }
        onOk={async () => {
          if (
            !otaSyncDateRange?.[0]?.isValid() ||
            !otaSyncDateRange?.[1]?.isValid()
          ) {
            message.warning("请选择同步日期范围");
            return;
          }
          const sessionDateStart = otaSyncDateRange[0].format("YYYY-MM-DD");
          const sessionDateEnd = otaSyncDateRange[1].format("YYYY-MM-DD");
          if (otaSyncPlatform === "maoyan") {
            if (!eid) {
              message.warning("缺少展会 ID");
              return;
            }
            try {
              await syncInfoToMaoyan(eid, {
                sessionDateStart,
                sessionDateEnd,
              });
              setOtaSyncModalOpen(false);
            } catch {
              /* 错误已在 hook 中提示 */
            }
            return;
          }
          if (otaSyncPlatform === "damai") {
            if (!eid) {
              message.warning("缺少展会 ID");
              return;
            }
            try {
              await syncInfoToDamai(eid, {
                start_session_date: sessionDateStart,
                end_session_date: sessionDateEnd,
              });
              setOtaSyncModalOpen(false);
            } catch {
              /* 错误已在 hook 中提示 */
            }
            return;
          }
          if (otaSyncScopes.length === 0) {
            message.warning("请至少选择一项同步内容");
            return;
          }
          message.info("同步接口暂未对接，请稍后在版本中接入");
          setOtaSyncModalOpen(false);
        }}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        maskClosable={false}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          当前展会：{data?.name ?? "—"}
        </Typography.Paragraph>
        <Flex gap={token.marginLG} wrap="wrap" align="flex-start">
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <Typography.Text
              type="secondary"
              style={{ display: "block", marginBottom: 8 }}
            >
              同步目标（单选）
            </Typography.Text>
            <Radio.Group
              value={otaSyncPlatform}
              onChange={(e) => {
                const v = e.target.value as OtaSyncPlatform;
                setOtaSyncPlatform(v);
                if (v === "ctrip") {
                  setOtaSyncScopes((prev) =>
                    prev.filter((s) => s !== "tickets"),
                  );
                }
              }}
            >
              <Space direction="vertical">
                <Radio value="maoyan">猫眼</Radio>
                <Radio value="damai">大麦</Radio>
                <Radio value="ctrip">携程</Radio>
              </Space>
            </Radio.Group>
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <Typography.Text
              type="secondary"
              style={{ display: "block", marginBottom: 8 }}
            >
              同步内容（可多选）
            </Typography.Text>
            {otaSyncPlatform === "maoyan" || otaSyncPlatform === "damai" ? (
              <Space direction="vertical" size="small">
                {OTA_SYNC_FIXED_CONTENT[otaSyncPlatform].rows.map((row) => (
                  <Checkbox
                    key={`${otaSyncPlatform}-${row.label}`}
                    checked={row.checked}
                    disabled
                  >
                    {row.label}
                  </Checkbox>
                ))}
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 0, fontSize: 12 }}
                >
                  {OTA_SYNC_FIXED_CONTENT[otaSyncPlatform].hint}
                </Typography.Paragraph>
              </Space>
            ) : (
              <Checkbox.Group
                value={otaSyncScopes}
                onChange={(v) => setOtaSyncScopes(v as OtaSyncScope[])}
              >
                <Space direction="vertical" size="small">
                  <Checkbox value="sessions">场次</Checkbox>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Checkbox
                      value="tickets"
                      disabled={otaSyncPlatform === "ctrip"}
                    >
                      票种
                    </Checkbox>
                    {otaSyncPlatform === "ctrip" ? (
                      <Tooltip title="移步携程后台创建票种">
                        <InfoCircleOutlined
                          style={{
                            color: token.colorTextSecondary,
                            cursor: "default",
                          }}
                        />
                      </Tooltip>
                    ) : null}
                  </div>
                  <Checkbox value="price">价格</Checkbox>
                  <Checkbox value="inventory">库存</Checkbox>
                </Space>
              </Checkbox.Group>
            )}
          </div>
        </Flex>
        <div style={{ marginTop: token.marginMD }}>
          <Typography.Text
            type="secondary"
            style={{ display: "block", marginBottom: 8 }}
          >
            同步日期
          </Typography.Text>
          <DatePicker.RangePicker
            value={otaSyncDateRange}
            disabled={!otaExhibitionDateBounds}
            onChange={(v) =>
              setOtaSyncDateRange(v && v[0] && v[1] ? [v[0], v[1]] : null)
            }
            format="YYYY-MM-DD"
            style={{ width: "100%", maxWidth: 360 }}
            disabledDate={(current) => {
              if (!otaExhibitionDateBounds || !current) return false;
              return (
                current.isBefore(otaExhibitionDateBounds.start, "day") ||
                current.isAfter(otaExhibitionDateBounds.end, "day")
              );
            }}
            placeholder={["开始日期", "结束日期"]}
          />
          {otaExhibitionDateBounds ? (
            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
            >
              可选范围与展期一致：
              {otaExhibitionDateBounds.start.format("YYYY-MM-DD")} ~{" "}
              {otaExhibitionDateBounds.end.format("YYYY-MM-DD")}
            </Typography.Paragraph>
          ) : null}
        </div>
      </Modal>

      <ModalForm<{ quantity: number }>
        title={ticketInvData ? `设置库存 · ${ticketInvData.name}` : "设置库存"}
        open={ticketInvVisible}
        onOpenChange={(open) => {
          if (!open) closeTicketInvModal();
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
          将为本票种在<strong>全部场次</strong>
          下设置相同的库存上限数量（对应接口 PUT
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
        open={addTicketVisible}
        onOpenChange={(open) => {
          if (!open) closeAddTicketModal();
        }}
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
          fieldProps={{ min: 0, precision: 2, style: { width: "100%" } }}
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
