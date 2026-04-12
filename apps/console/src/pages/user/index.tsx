import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  CopyOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import type { User as UserTypes } from "@cr7/types";
import { assignUserRoleApi, createUserApi, listUsersApi } from "@/apis/user";
import { usePermission } from "@/hooks/use-permissions";
import {
  normalizeProTablePaging,
  useTableQuery,
} from "@/hooks/use-table-query";
import { formatDateTime } from "@/utils/format-datetime";
import { pickApiErrorMessage } from "@/utils/pick-api-error";
import "./user.less";

type UserRow = UserTypes.Profile;

const UserPage = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { roles } = usePermission();
  const actionRef = useRef<ActionType>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<{
    name: string;
    phone: string;
    password: string;
    role_ids: string[];
  }>();

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
        render: (text) =>
          text || <Typography.Text type="secondary">-</Typography.Text>,
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
    ],
    [message, rowIndexBase],
  );

  const handleCreateUser = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const profile = await createUserApi({
        name: values.name.trim(),
        phone: values.phone.trim(),
        country_code: "+86",
        password: values.password,
      });
      try {
        await assignUserRoleApi(profile.id, values.role_ids);
      } catch (assignErr) {
        message.error(
          pickApiErrorMessage(assignErr) ||
            "用户已创建，但分配角色失败，请稍后在用户管理中为该用户分配角色",
        );
        setCreateModalOpen(false);
        createForm.resetFields();
        actionRef.current?.reload();
        return;
      }
      message.success("用户已创建并已分配所选角色");
      setCreateModalOpen(false);
      createForm.resetFields();
      actionRef.current?.reload();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) {
        return;
      }
      message.error(pickApiErrorMessage(err) || "创建用户失败");
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, message]);

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
            <li>
              用户列表来自 `GET /users`，支持按手机号精确筛选，并使用 `page /
              limit` 分页。
            </li>
            <li>手机号筛选支持输入完整格式，例如 `+86 12345678901`。</li>
            <li>
              「添加用户」须填写手机号、密码并<strong>至少选择一个角色</strong>
              （创建成功后并行授予所选角色）。
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
        className="user-list-card"
        variant="borderless"
        title="用户列表"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              添加用户
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => actionRef.current?.reload()}
            >
              刷新
            </Button>
          </Space>
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

      <Modal
        title="添加用户"
        open={createModalOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={createSubmitting}
        destroyOnClose
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreateUser}
      >
        <Form
          form={createForm}
          layout="vertical"
          preserve={false}
          autoComplete="off"
          style={{ marginTop: 8 }}
        >
          <Form.Item
            name="name"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              { max: 100, message: "用户名过长" },
            ]}
          >
            <Input placeholder="显示名称" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: "请输入手机号" },
              {
                pattern: /^1[3-9]\d{9}$/,
                message: "请输入 11 位中国大陆手机号",
              },
            ]}
          >
            <Input placeholder="11 位手机号" maxLength={11} inputMode="numeric" />
          </Form.Item>
          <Form.Item
            name="role_ids"
            label="角色"
            rules={[
              {
                type: "array",
                required: true,
                min: 1,
                message: "请至少选择一个角色",
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="请选择要授予的角色，可多选"
              loading={roles.loading}
              disabled={roles.loading || roles.data.length === 0}
              options={roles.data.map((r) => ({
                value: r.id,
                label: r.is_builtin ? (
                  <Space size={8} align="center" wrap={false}>
                    <span>{r.name}</span>
                    <Tag color="default">内置</Tag>
                  </Space>
                ) : (
                  <span>{r.name}</span>
                ),
              }))}
              showSearch
              maxTagCount="responsive"
              filterOption={(input, option) => {
                const role = roles.data.find((x) => x.id === option?.value);
                return (role?.name ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase());
              }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, message: "密码至少 8 位" },
            ]}
          >
            <Input.Password placeholder="至少 8 位" autoComplete="new-password" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            默认使用区号 +86；手机号需与登录页校验规则一致。
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  );
};

export default UserPage;
