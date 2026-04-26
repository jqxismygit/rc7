import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  EyeOutlined,
  HomeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type {
  ActionType,
  ProColumns,
} from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import type { Cdkey as CdkeyTypes, Exhibition as ExhibitionTypes } from "@cr7/types";
import dayjs from "dayjs";
import {
  createCdkeyBatchApi,
  getCdkeyDetailApi,
  listBatchCdkeysApi,
  listCdkeyBatchesApi,
  listExhibitionTicketsApi,
  listExhibitionsApi,
} from "@/apis";
import {
  normalizeProTablePaging,
  useTableQuery,
} from "@/hooks/use-table-query";
import { formatDateTime } from "@/utils/format-datetime";
import { pickApiErrorMessage } from "@/utils/pick-api-error";
import "./cdk.less";

type CdkeyBatchRow = CdkeyTypes.CdkeyBatch;
type CdkeyCreateFormValues = {
  eid: string;
  name: string;
  ticket_category_id: string;
  quantity: number;
  redeem_valid_until: dayjs.Dayjs;
};

const CdkPage = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<CdkeyCreateFormValues>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEid, setSelectedEid] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [exhibitions, setExhibitions] = useState<ExhibitionTypes.Exhibition[]>([]);
  const [ticketOptions, setTicketOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [codesModalOpen, setCodesModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CdkeyBatchRow | null>(null);
  const [codeKeyword, setCodeKeyword] = useState("");
  const [codeDetailModalOpen, setCodeDetailModalOpen] = useState(false);
  const [codeDetailLoading, setCodeDetailLoading] = useState(false);
  const [selectedCdkey, setSelectedCdkey] = useState<CdkeyTypes.Cdkey | null>(null);
  const [tableEid, setTableEid] = useState<string>();

  const { proTablePagination, rowIndexBase } = useTableQuery({
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const exhibitionOptions = useMemo(
    () =>
      exhibitions.map((item) => ({
        label: item.name,
        value: item.id,
      })),
    [exhibitions],
  );

  const defaultActiveEid = useMemo(() => {
    const active = exhibitions.find((item) => item.status === "ENABLE");
    return active?.id || exhibitions[0]?.id;
  }, [exhibitions]);

  const loadExhibitions = useCallback(async () => {
    const res = await listExhibitionsApi({ all: true });
    setExhibitions(res.data ?? []);
  }, []);

  const loadTickets = useCallback(
    async (eid: string) => {
      setTicketLoading(true);
      try {
        const rows = await listExhibitionTicketsApi(eid);
        setTicketOptions(
          (rows ?? []).map((row) => ({
            value: row.id,
            label: `${row.name}（￥${(row.list_price / 100).toFixed(2)}）`,
          })),
        );
      } catch (err) {
        setTicketOptions([]);
        message.error(pickApiErrorMessage(err) || "加载票种失败");
      } finally {
        setTicketLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    void loadExhibitions().catch((err) => {
      message.error(pickApiErrorMessage(err) || "加载展会失败");
    });
  }, [loadExhibitions, message]);

  useEffect(() => {
    if (!defaultActiveEid) return;
    setTableEid((prev) => prev || defaultActiveEid);
  }, [defaultActiveEid]);

  const columns = useMemo<ProColumns<CdkeyBatchRow>[]>(
    () => [
      {
        title: "序号",
        width: 64,
        align: "center",
        search: false,
        render: (_, __, index) => rowIndexBase + index + 1,
      },
      {
        title: "批次 ID",
        dataIndex: "id",
        width: 220,
        search: false,
        ellipsis: true,
      },
      {
        title: "批次名称",
        dataIndex: "name",
        width: 180,
        search: false,
      },
      {
        title: "展会",
        dataIndex: ["exhibition", "name"],
        width: 180,
        search: false,
      },
      {
        title: "票种",
        dataIndex: ["ticket_category", "name"],
        width: 180,
        search: false,
      },
      {
        title: "单码可兑",
        dataIndex: "redeem_quantity",
        width: 100,
        align: "center",
        search: false,
      },
      {
        title: "总码数",
        dataIndex: "quantity",
        width: 100,
        align: "right",
        search: false,
      },
      {
        title: "已使用",
        dataIndex: "used_count",
        width: 100,
        align: "right",
        search: false,
        render: (_, row) => (
          <Tag color={row.used_count > 0 ? "processing" : "default"}>
            {row.used_count}
          </Tag>
        ),
      },
      {
        title: "有效期截止",
        dataIndex: "redeem_valid_until",
        width: 140,
        search: false,
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 168,
        search: false,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatDateTime(row.created_at)}
          </Typography.Text>
        ),
      },
      {
        title: "操作",
        key: "action",
        width: 120,
        fixed: "right",
        search: false,
        render: (_, row) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedBatch(row);
              setCodesModalOpen(true);
            }}
          >
            查看
          </Button>
        ),
      },
    ],
    [defaultActiveEid, exhibitionOptions, rowIndexBase],
  );

  const codeColumns = useMemo<ProColumns<CdkeyTypes.Cdkey>[]>(
    () => [
      {
        title: "兑换码",
        dataIndex: "code",
        width: 180,
        search: false,
      },
      {
        title: "状态",
        dataIndex: "status",
        width: 100,
        valueType: "select",
        search: false,
        render: (_, row) => (
          <Tag color={row.status === "USED" ? "processing" : "default"}>
            {row.status === "USED" ? "已使用" : "未使用"}
          </Tag>
        ),
      },
      {
        title: "票种",
        dataIndex: ["ticket_category", "name"],
        width: 160,
        search: false,
      },
      {
        title: "使用人",
        key: "redeemed_by",
        width: 150,
        search: false,
        render: (_, row) => row.redeemed_by?.phone || "—",
      },
      {
        title: "核销场次",
        key: "redeemed_session",
        width: 170,
        search: false,
        render: (_, row) => row.redeemed_session?.session_date || "—",
      },
      {
        title: "使用时间",
        dataIndex: "redeemed_at",
        width: 168,
        search: false,
        render: (_, row) =>
          row.redeemed_at ? (
            <Typography.Text type="secondary">
              {formatDateTime(row.redeemed_at)}
            </Typography.Text>
          ) : (
            "—"
          ),
      },
      {
        title: "有效期截止",
        dataIndex: "redeem_valid_until",
        width: 140,
        search: false,
      },
    ],
    [],
  );

  const handleCreate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createCdkeyBatchApi({
        eid: values.eid,
        name: values.name.trim(),
        ticket_category_id: values.ticket_category_id,
        quantity: values.quantity,
        // 按需求固定，不允许页面编辑
        redeem_quantity: 1,
        redeem_valid_until: values.redeem_valid_until.format("YYYY-MM-DD"),
      });
      message.success("CDK 批次创建成功");
      setCreateModalOpen(false);
      form.resetFields([
        "name",
        "ticket_category_id",
        "quantity",
        "redeem_valid_until",
      ]);
      actionRef.current?.reload();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error(pickApiErrorMessage(err) || "创建失败");
    } finally {
      setSubmitting(false);
    }
  }, [form, message]);

  const openCreateModal = useCallback(() => {
    setSelectedEid(undefined);
    setTicketOptions([]);
    form.resetFields();
    form.setFieldsValue({ quantity: 10 });
    setCreateModalOpen(true);
  }, [form]);

  const handleSearchCdkey = useCallback(
    async (value?: string) => {
      const keyword = String(value ?? codeKeyword).trim();
      if (!keyword) {
        message.warning("请输入兑换码");
        return;
      }
      setCodeDetailLoading(true);
      try {
        const detail = await getCdkeyDetailApi(keyword);
        setSelectedCdkey(detail);
        setCodeDetailModalOpen(true);
      } catch (err) {
        message.error(pickApiErrorMessage(err) || "查询兑换码失败");
      } finally {
        setCodeDetailLoading(false);
      }
    },
    [codeKeyword, message],
  );

  return (
    <div className="cdk-admin-page">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Breadcrumb
          items={[
            {
              title: (
                <Link to="/exhibition">
                  <Space size={4}>
                    <HomeOutlined />
                    <span>控制台</span>
                  </Space>
                </Link>
              ),
            },
            { title: "CDK 管理" },
          ]}
        />

        <Alert
          className="cdk-config-alert"
          type="info"
          showIcon
          message="CDK 批次创建规则"
          description={
            <ol>
              <li>每次创建均会固定将 `redeem_quantity` 设置为 1。</li>
              <li>请先选择展会，再选择对应票种。</li>
              <li>创建后可在下方列表按展会分页查看批次。</li>
            </ol>
          }
        />

        <Modal
          title="创建 CDK 批次"
          open={createModalOpen}
          destroyOnClose
          maskClosable={false}
          width={840}
          okText="创建批次"
          cancelText="取消"
          confirmLoading={submitting}
          onOk={() => void handleCreate()}
          onCancel={() => {
            if (submitting) return;
            setCreateModalOpen(false);
            setSelectedEid(undefined);
          }}
        >
          <Form<CdkeyCreateFormValues>
            form={form}
            layout="vertical"
            initialValues={{ quantity: 10 }}
            preserve={false}
          >
            <div className="cdk-create-grid">
              <Form.Item
                name="eid"
                label="展会"
                rules={[{ required: true, message: "请选择展会" }]}
              >
                <Select
                  showSearch
                  placeholder="请选择展会"
                  options={exhibitionOptions}
                  optionFilterProp="label"
                  onChange={(value) => {
                    setSelectedEid(value);
                    form.setFieldValue("ticket_category_id", undefined);
                    setTicketOptions([]);
                    void loadTickets(value);
                  }}
                />
              </Form.Item>

              <Form.Item
                name="ticket_category_id"
                label="票种"
                rules={[{ required: true, message: "请选择票种" }]}
              >
                <Select
                  placeholder={selectedEid ? "请选择票种" : "请先选择展会"}
                  disabled={!selectedEid}
                  loading={ticketLoading}
                  options={ticketOptions}
                />
              </Form.Item>

              <Form.Item
                name="name"
                label="批次名称"
                rules={[
                  { required: true, message: "请输入批次名称" },
                  { max: 64, message: "批次名称最多 64 字" },
                ]}
              >
                <Input placeholder="例如：五一联名活动第一批" maxLength={64} />
              </Form.Item>

              <Form.Item
                name="quantity"
                label="生成数量"
                rules={[{ required: true, message: "请输入生成数量" }]}
              >
                <InputNumber
                  min={1}
                  max={100000}
                  style={{ width: "100%" }}
                  placeholder="请输入生成数量"
                />
              </Form.Item>

              <Form.Item label="单码可兑数量（固定）">
                <Input value="1" disabled />
              </Form.Item>

              <Form.Item
                name="redeem_valid_until"
                label="兑换截止日期"
                rules={[{ required: true, message: "请选择兑换截止日期" }]}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="YYYY-MM-DD"
                  disabledDate={(current) =>
                    !!current && current.endOf("day").isBefore(dayjs().startOf("day"))
                  }
                />
              </Form.Item>
            </div>
          </Form>
        </Modal>

        <Modal
          title={
            selectedBatch
              ? `批次兑换码 - ${selectedBatch.name}`
              : "批次兑换码"
          }
          open={codesModalOpen}
          width={1100}
          footer={null}
          destroyOnClose
          onCancel={() => {
            setCodesModalOpen(false);
            setSelectedBatch(null);
          }}
        >
          <ProTable<CdkeyTypes.Cdkey>
            rowKey="id"
            size="small"
            cardBordered={false}
            options={false}
            search={false}
            dateFormatter="string"
            scroll={{ x: 960 }}
            columns={codeColumns}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total) => `共 ${total} 条`,
            }}
            request={async (params) => {
              const bid = selectedBatch?.id;
              if (!bid) {
                return { data: [], success: true, total: 0 };
              }
              const paging = normalizeProTablePaging(params, {
                maxPageSize: 100,
                fallbackCurrent: 1,
                fallbackPageSize: 20,
              });
              try {
                const res = await listBatchCdkeysApi({
                  bid,
                  page: paging.current,
                  limit: paging.limit,
                });
                return {
                  data: res.codes ?? [],
                  success: true,
                  total: res.total ?? 0,
                };
              } catch (err) {
                message.error(pickApiErrorMessage(err) || "加载兑换码列表失败");
                return { data: [], success: false, total: 0 };
              }
            }}
          />
        </Modal>

        <Modal
          title="兑换码详情"
          open={codeDetailModalOpen}
          width={760}
          footer={null}
          destroyOnClose
          onCancel={() => {
            setCodeDetailModalOpen(false);
            setSelectedCdkey(null);
          }}
        >
          {selectedCdkey ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="兑换码" span={2}>
                {selectedCdkey.code}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedCdkey.status === "USED" ? "processing" : "default"}>
                  {selectedCdkey.status === "USED" ? "已使用" : "未使用"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="单码可兑数量">
                {selectedCdkey.redeem_quantity}
              </Descriptions.Item>
              <Descriptions.Item label="展会" span={2}>
                {selectedCdkey.exhibition?.name || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="票种" span={2}>
                {selectedCdkey.ticket_category?.name || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="核销用户">
                {selectedCdkey.redeemed_by?.phone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="核销场次">
                {selectedCdkey.redeemed_session?.session_date || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="核销时间" span={2}>
                {selectedCdkey.redeemed_at
                  ? formatDateTime(selectedCdkey.redeemed_at)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="有效期截止">
                {selectedCdkey.redeem_valid_until || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(selectedCdkey.created_at)}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
        </Modal>

        <Card className="cdk-list-card" title="CDK 批次列表">
          <ProTable<CdkeyBatchRow>
            actionRef={actionRef}
            rowKey="id"
            size="middle"
            cardBordered={false}
            options={false}
            scroll={{ x: 1300 }}
            dateFormatter="string"
            pagination={proTablePagination}
            columns={columns}
            params={{ eid: tableEid }}
            toolbar={{
              title: (
                <Select
                  style={{ width: 240 }}
                  showSearch
                  value={tableEid}
                  options={exhibitionOptions}
                  optionFilterProp="label"
                  placeholder="筛选展会"
                  onChange={(value) => {
                    setTableEid(value);
                  }}
                />
              ),
              actions: [
                <Input.Search
                  key="search-cdkey"
                  allowClear
                  placeholder="输入兑换码查询详情"
                  style={{ width: 280 }}
                  enterButton="查询"
                  loading={codeDetailLoading}
                  value={codeKeyword}
                  onChange={(e) => setCodeKeyword(e.target.value)}
                  onSearch={(value) => void handleSearchCdkey(value)}
                />,
                <Button
                  key="create-batch"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                >
                  创建批次
                </Button>,
              ],
            }}
            request={async (params) => {
              const eid = String(params.eid ?? "").trim();
              if (!eid) {
                return { data: [], success: true, total: 0 };
              }
              const paging = normalizeProTablePaging(params, {
                maxPageSize: 100,
                fallbackCurrent: 1,
                fallbackPageSize: 20,
              });
              try {
                const res = await listCdkeyBatchesApi({
                  eid,
                  page: paging.current,
                  limit: paging.limit,
                });
                return {
                  data: res.batches ?? [],
                  success: true,
                  total: res.total ?? 0,
                };
              } catch (err) {
                message.error(pickApiErrorMessage(err) || "加载批次列表失败");
                return { data: [], success: false, total: 0 };
              }
            }}
            search={false}
          />
        </Card>
      </Space>
    </div>
  );
};

export default CdkPage;
