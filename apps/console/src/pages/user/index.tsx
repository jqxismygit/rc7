import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ActionType, ProColumns } from "@ant-design/pro-components";
import { ProTable } from "@ant-design/pro-components";
import type { User as UserTypes } from "@cr7/types";
import {
  assignUserRoleApi,
  createUserApi,
  diffRoleIds,
  listUsersApi,
  syncUserRolesToTargetApi,
} from "@/apis/user";
import { usePermission } from "@/hooks/use-permissions";
import {
  normalizeProTablePaging,
  useTableQuery,
} from "@/hooks/use-table-query";
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

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm] = Form.useForm<{ role_ids: string[] }>();

  const editRoleOptions = useMemo(() => {
    const m = new Map<string, UserTypes.Role>();
    for (const r of roles.data) m.set(r.id, r);
    for (const r of editingUser?.roles ?? []) {
      if (!m.has(r.id)) m.set(r.id, r);
    }
    return Array.from(m.values());
  }, [roles.data, editingUser]);

  const { proTablePagination, rowIndexBase } = useTableQuery({
    defaultPageSize: 10,
    maxPageSize: 100,
  });

  const openEditRoles = useCallback((row: UserRow) => {
    setEditingUser(row);
    setEditModalOpen(true);
  }, []);

  /** 弹窗打开且选项就绪后写入角色，避免 roles 列表晚于弹窗导致多选不回显 */
  const editingRoleIds = useMemo(
    () => editingUser?.roles?.map((r) => r.id) ?? [],
    [editingUser],
  );

  useEffect(() => {
    if (!editModalOpen || !editingUser) return;
    editForm.setFieldsValue({
      role_ids: editingRoleIds,
    });
  }, [editModalOpen, editingUser, editForm, editingRoleIds, editRoleOptions]);

  const syncEditRoleIdsToForm = useCallback(() => {
    if (!editingUser) return;
    editForm.setFieldsValue({ role_ids: editingRoleIds });
  }, [editForm, editingUser, editingRoleIds]);

  const handleSaveEditRoles = useCallback(async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingUser) return;
      const prev = editingUser.roles?.map((r) => r.id) ?? [];
      const next = values.role_ids ?? [];
      const { toRemove, toAdd } = diffRoleIds(prev, next);
      if (toRemove.length === 0 && toAdd.length === 0) {
        message.info("角色未变更");
        setEditModalOpen(false);
        setEditingUser(null);
        editForm.resetFields();
        return;
      }
      setEditSubmitting(true);
      await syncUserRolesToTargetApi(editingUser.id, prev, next);
      message.success("角色已更新");
      setEditModalOpen(false);
      setEditingUser(null);
      editForm.resetFields();
      actionRef.current?.reload();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) {
        return;
      }
      message.error(pickApiErrorMessage(err) || "更新角色失败");
    } finally {
      setEditSubmitting(false);
    }
  }, [editForm, editingUser, message, actionRef]);

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
      {
        title: "角色",
        dataIndex: "roles",
        width: 260,
        search: false,
        render: (_, row) => {
          const list = row.roles ?? [];
          if (list.length === 0) {
            return <Typography.Text type="secondary">未分配</Typography.Text>;
          }
          return (
            <Space size={[6, 6]} wrap>
              {list.map((r) => (
                <Tag key={r.id} color={r.is_builtin ? "default" : "blue"}>
                  {r.name}
                </Tag>
              ))}
            </Space>
          );
        },
      },
      {
        title: "操作",
        key: "action",
        width: 108,
        fixed: "right",
        search: false,
        render: (_, row) => (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditRoles(row)}
          >
            编辑
          </Button>
        ),
      },
    ],
    [message, openEditRoles, rowIndexBase],
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
            <li>
              「编辑角色」弹窗中用户名与手机号为禁用输入框样式（只读），仅
              <strong>角色</strong>可多选修改。
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
            <Input
              placeholder="11 位手机号"
              maxLength={11}
              inputMode="numeric"
            />
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
            <Input.Password
              placeholder="至少 8 位"
              autoComplete="new-password"
            />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            默认使用区号 +86；手机号需与登录页校验规则一致。
          </Typography.Text>
        </Form>
      </Modal>

      <Modal
        title={editingUser ? `编辑角色 · ${editingUser.name}` : "编辑角色"}
        open={editModalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={editSubmitting}
        destroyOnClose
        width={520}
        afterOpenChange={(open) => {
          if (open) {
            syncEditRoleIdsToForm();
          }
        }}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingUser(null);
          editForm.resetFields();
        }}
        onOk={handleSaveEditRoles}
      >
        {editingUser ? (
          <Form
            form={editForm}
            layout="vertical"
            preserve={false}
            style={{ marginTop: 8 }}
          >
            <Form.Item label="用户名">
              <Input disabled value={editingUser.name || ""} placeholder="-" />
            </Form.Item>
            <Form.Item label="手机号">
              <Input
                disabled
                value={editingUser.phone || ""}
                placeholder="未绑定"
              />
            </Form.Item>
            <Form.Item name="role_ids" label="角色">
              <Select
                mode="multiple"
                allowClear
                placeholder="可多选；清空表示收回全部角色"
                loading={roles.loading}
                disabled={roles.loading && editRoleOptions.length === 0}
                options={editRoleOptions.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                tagRender={(props) => {
                  const { value, closable, onClose } = props;
                  const r = editRoleOptions.find((x) => x.id === value);
                  return (
                    <Tag
                      color={r?.is_builtin ? "default" : "blue"}
                      closable={closable}
                      onClose={onClose}
                      style={{ marginInlineEnd: 4 }}
                    >
                      {r?.name ?? String(value)}
                      {r?.is_builtin ? "（内置）" : ""}
                    </Tag>
                  );
                }}
                showSearch
                maxTagCount="responsive"
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
              />
            </Form.Item>
          </Form>
        ) : null}
      </Modal>
    </div>
  );
};

export default UserPage;
