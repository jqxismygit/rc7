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
import type { User as UserTypes } from "@cr7/types";
import { listUsersApi } from "@/apis/user";
import {
  normalizeProTablePaging,
  useTableQuery,
} from "@/hooks/use-table-query";
import { formatDateTime } from "@/utils/format-datetime";
import { pickApiErrorMessage } from "@/utils/pick-api-error";
import "./user.less";

type UserRow = UserTypes.Profile;

const authMethodLabelMap: Record<string, string> = {
  WECHAT_MINI: "微信小程序",
  PASSWORD: "密码登录",
};

const UserPage = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { proTablePagination, rowIndexBase } = useTableQuery({
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  const columns = useMemo<ProColumns<UserRow>[]>(
    () => [
      {
        title: "序号",
        width: 64,
        align: "center",
        search: false,
        render: (_, __, index) => rowIndexBase + index + 1,
      },
      {
        title: "用户 ID",
        dataIndex: "id",
        width: 220,
        search: false,
        render: (_, row) => (
          <Space size={6} align="center" wrap={false}>
            <Typography.Text
              ellipsis={{ tooltip: row.id }}
              style={{ maxWidth: 150, fontSize: 12 }}
            >
              {row.id}
            </Typography.Text>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              style={{ padding: 0, height: "auto" }}
              aria-label="复制用户 ID"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(row.id);
                  message.success("用户 ID 已复制");
                } catch {
                  message.error("复制失败");
                }
              }}
            />
          </Space>
        ),
      },
      {
        title: "用户名",
        dataIndex: "name",
        width: 180,
        ellipsis: true,
        search: false,
        render: (text) => text || <Typography.Text type="secondary">-</Typography.Text>,
      },
      {
        title: "手机号",
        dataIndex: "phone",
        width: 180,
        ellipsis: true,
        render: (text) =>
          text ? (
            text
          ) : (
            <Typography.Text type="secondary">未绑定</Typography.Text>
          ),
      },
      {
        title: "微信 OpenID",
        dataIndex: "openid",
        width: 220,
        search: false,
        render: (text) =>
          text ? (
            <Typography.Text ellipsis={{ tooltip: text }} style={{ maxWidth: 180 }}>
              {text}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">未绑定</Typography.Text>
          ),
      },
      {
        title: "登录方式",
        dataIndex: "auth_methods",
        width: 200,
        search: false,
        render: (_, row) => {
          const methods = row.auth_methods ?? [];
          if (!methods.length) {
            return <Typography.Text type="secondary">-</Typography.Text>;
          }
          return (
            <Space size={[4, 4]} wrap>
              {methods.map((method) => (
                <Tag key={method} color={method === "PASSWORD" ? "blue" : "green"}>
                  {authMethodLabelMap[method] ?? method}
                </Tag>
              ))}
            </Space>
          );
        },
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 180,
        search: false,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatDateTime(row.created_at)}
          </Typography.Text>
        ),
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        width: 180,
        search: false,
        render: (_, row) => (
          <Typography.Text type="secondary">
            {formatDateTime(row.updated_at)}
          </Typography.Text>
        ),
      },
    ],
    [message, rowIndexBase],
  );

  return (
    <div className="user-admin-page">
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
            title: <span style={{ color: token.colorText }}>用户</span>,
          },
        ]}
      />

      <Alert
        className="user-config-alert"
        type="info"
        showIcon
        message="配置说明"
        description={
          <ol>
            <li>用户列表来自 `GET /users`，支持按手机号精确筛选，并使用 `page / limit` 分页。</li>
            <li>手机号筛选支持输入完整格式，例如 `+86 12345678901`。</li>
            <li>列表展示用户主体信息、手机号绑定情况、微信绑定情况和可用登录方式。</li>
          </ol>
        }
        style={{
          marginBottom: token.marginMD,
          background: "#e6f7ff",
          border: "1px solid #91d5ff",
        }}
      />

      <Card
        className="user-list-card"
        variant="borderless"
        title="用户列表"
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
        <ProTable<UserRow>
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
            const phone =
              typeof params.phone === "string" && params.phone.trim()
                ? params.phone.trim()
                : undefined;
            try {
              const res = await listUsersApi({
                phone,
                page: paging.current,
                limit: paging.limit,
              });
              return {
                data: res.users,
                success: true,
                total: res.total,
              };
            } catch (err) {
              message.error(pickApiErrorMessage(err) || "加载用户列表失败");
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </Card>
    </div>
  );
};

export default UserPage;
