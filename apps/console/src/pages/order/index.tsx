import { useMemo, useRef } from "react";
import { Link } from "react-router";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import { CopyOutlined, HomeOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import type { Order as OrderTypes } from "@cr7/types";
import { listAdminOrdersApi } from "@/apis/order";
import {
  normalizeProTablePaging,
  useTableQuery,
} from "@/hooks/use-table-query";
import { formatDateTime } from "@/utils/format-datetime";
import { pickApiErrorMessage } from "@/utils/pick-api-error";
import "./order.less";

type OrderRow = OrderTypes.OrderWithItems;

const ORDER_STATUS_LABEL: Record<OrderTypes.OrderStatus, string> = {
  PENDING_PAYMENT: "待支付",
  PAID: "已支付",
  REFUND_REQUESTED: "退款已受理",
  REFUND_PROCESSING: "退款处理中",
  REFUNDED: "已退款",
  REFUND_FAILED: "退款失败",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
};

const ORDER_STATUS_OPTIONS = (
  Object.entries(ORDER_STATUS_LABEL) as [OrderTypes.OrderStatus, string][]
).map(([value, label]) => ({ label, value }));

function orderStatusTagColor(
  status: OrderTypes.OrderStatus,
): string | undefined {
  switch (status) {
    case "PENDING_PAYMENT":
      return "gold";
    case "PAID":
      return "success";
    case "REFUND_REQUESTED":
    case "REFUND_PROCESSING":
      return "processing";
    case "REFUNDED":
      return "default";
    case "REFUND_FAILED":
      return "error";
    case "CANCELLED":
      return "default";
    case "EXPIRED":
      return "warning";
    default:
      return undefined;
  }
}

const ORDER_SOURCE_LABEL: Record<OrderTypes.OrderSource, string> = {
  DIRECT: "站内",
  CTRIP: "携程",
  MOP: "猫眼",
  DAMAI: "大麦",
};

/** 金额与票种 price 一致，后端为分 */
function formatAmountFen(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const OrderPage = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { proTablePagination, rowIndexBase } = useTableQuery({
    defaultPageSize: 20,
    maxPageSize: 100,
  });

  const columns = useMemo<ProColumns<OrderRow>[]>(
    () => [
      {
        title: "序号",
        width: 64,
        align: "center",
        search: false,
        render: (_, __, index) => rowIndexBase + index + 1,
      },
      {
        title: "订单 ID",
        dataIndex: "id",
        width: 200,
        search: false,
        ellipsis: true,
        render: (_, row) => (
          <Space size={6} align="center" wrap={false}>
            <Typography.Text
              ellipsis={{ tooltip: row.id }}
              style={{ maxWidth: 130, fontSize: 12 }}
            >
              {row.id}
            </Typography.Text>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              style={{ padding: 0, height: "auto" }}
              aria-label="复制订单 ID"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(row.id);
                  message.success("订单 ID 已复制");
                } catch {
                  message.error("复制失败");
                }
              }}
            />
          </Space>
        ),
      },
      {
        title: "状态",
        dataIndex: "status",
        width: 120,
        valueType: "select",
        fieldProps: {
          allowClear: true,
          placeholder: "全部",
          options: ORDER_STATUS_OPTIONS,
        },
        render: (_, row) => (
          <Tag color={orderStatusTagColor(row.status)}>
            {ORDER_STATUS_LABEL[row.status]}
          </Tag>
        ),
      },
      {
        title: "来源",
        dataIndex: "source",
        width: 88,
        search: false,
        render: (_, row) => ORDER_SOURCE_LABEL[row.source] ?? row.source,
      },
      {
        title: "用户 ID",
        dataIndex: "user_id",
        width: 200,
        search: false,
        ellipsis: true,
      },
      {
        title: "展会 ID",
        dataIndex: "exhibit_id",
        width: 200,
        search: false,
        ellipsis: true,
      },
      {
        title: "场次 ID",
        dataIndex: "session_id",
        width: 200,
        search: false,
        ellipsis: true,
      },
      {
        title: "总金额（元）",
        dataIndex: "total_amount",
        width: 120,
        align: "right",
        search: false,
        render: (_, row) => formatAmountFen(row.total_amount),
      },
      {
        title: "订单项",
        dataIndex: "items",
        width: 140,
        search: false,
        render: (_, row) => {
          const items = row.items ?? [];
          const qty = items.reduce((s, i) => s + i.quantity, 0);
          return (
            <Typography.Text type="secondary">
              {items.length} 类 · {qty} 张
            </Typography.Text>
          );
        },
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
        title: "支付时间",
        dataIndex: "paid_at",
        width: 168,
        search: false,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {row.paid_at ? formatDateTime(row.paid_at) : "—"}
          </Typography.Text>
        ),
      },
      {
        title: "过期时间",
        dataIndex: "expires_at",
        width: 168,
        search: false,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatDateTime(row.expires_at)}
          </Typography.Text>
        ),
      },
    ],
    [message, rowIndexBase],
  );

  return (
    <div className="order-admin-page">
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
            title: <span style={{ color: token.colorText }}>订单</span>,
          },
        ]}
      />

      <Alert
        className="order-config-alert"
        type="info"
        showIcon
        message="说明"
        description={
          <ol>
            <li>
              列表数据来自管理员接口 <Typography.Text code>GET /admin/orders</Typography.Text>
              ，支持按订单状态筛选与 <Typography.Text code>page / limit</Typography.Text>{" "}
              分页。
            </li>
            <li>包含用户已隐藏的订单；金额单位与票种一致（分存储，列表显示为元）。</li>
          </ol>
        }
        style={{
          marginBottom: token.marginMD,
          background: "#e6f7ff",
          border: "1px solid #91d5ff",
        }}
      />

      <Card
        className="order-list-card"
        variant="borderless"
        title="订单列表"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => actionRef.current?.reload()}
          >
            刷新
          </Button>
        }
        style={{
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <ProTable<OrderRow>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          scroll={{ x: "max-content" }}
          ghost
          cardProps={{ bodyStyle: { padding: 0 } }}
          options={false}
          search={{
            labelWidth: "auto",
            defaultCollapsed: false,
            searchText: "查询",
            resetText: "重置",
          }}
          pagination={proTablePagination}
          dateFormatter="string"
          headerTitle={false}
          toolBarRender={false}
          request={async (params) => {
            const paging = normalizeProTablePaging(params, {
              maxPageSize: 100,
            });
            const rawStatus = params.status;
            const status =
              typeof rawStatus === "string" && rawStatus.trim()
                ? (rawStatus.trim() as OrderTypes.OrderStatus)
                : undefined;
            try {
              const res = await listAdminOrdersApi({
                status,
                page: paging.current,
                limit: paging.limit,
              });
              return {
                data: res.orders,
                success: true,
                total: res.total,
              };
            } catch (err) {
              message.error(pickApiErrorMessage(err) || "加载订单列表失败");
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </Card>
    </div>
  );
};

export default OrderPage;
