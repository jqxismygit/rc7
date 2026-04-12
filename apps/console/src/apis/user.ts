import type { User as UserTypes } from "@cr7/types";
import { request } from "@/utils/request";
import permissions from "@/permissions.json";
import type { PermissionItem, PermissionType } from "@/types";

export type UserListQuery = {
  phone?: string;
  role_id?: string;
  page?: number;
  limit?: number;
  has_any_role?: boolean;
};

export type UserCreateInput = Pick<UserTypes.Profile, "name"> &
  Pick<UserTypes.PhoneBinding, "phone"> & {
    country_code?: UserTypes.PhoneBinding["country_code"];
    password: string;
  };

export const listUsersApi = async (
  params?: UserListQuery,
): Promise<UserTypes.UserListResult> => {
  const res = await request.get("/users", {
    params: { ...params, has_any_role: true },
  });
  return res as unknown as UserTypes.UserListResult;
};

export const getProfile = async (): Promise<UserTypes.Profile> => {
  const [profile, roles] = await Promise.all([
    request.get("/user/profile"),
    request.get("/user/roles"),
  ]);
  return {
    ...profile,
    ...roles,
  } as unknown as UserTypes.Profile;
};

export type ChangePasswordInput = {
  current_password: string;
  new_password: string;
};

export const changePasswordApi = async (
  data: ChangePasswordInput,
): Promise<void> => {
  await request.put("/user/password", data);
};

export const createRoleApi = async (data: UserTypes.Role): Promise<void> => {
  await request.post("/users/roles", data);
};

export const deleteRoleApi = async (id: string): Promise<void> => {
  await request.delete(`/users/roles/${id}`);
};

export const updateRoleApi = async (
  id: string,
  data: Pick<UserTypes.Role, "name" | "permissions">,
): Promise<void> => {
  await request.patch(`/users/roles/${id}`, data);
};

export type UserRolesResult = {
  roles: UserTypes.Role[];
  permissions: string[];
  isAdmin: boolean;
};

export const getRolesApi = async (): Promise<UserTypes.Role[]> => {
  const res = await request.get("/users/roles");
  return res as unknown as UserTypes.Role[];
};

/**
 * 为用户授予一个或多个角色（多角色时并行请求），
 * 见 docs/api/user.md「为用户授予角色」
 */
export const assignUserRoleApi = async (
  uid: string,
  role_id: string | string[],
): Promise<void> => {
  const ids = (Array.isArray(role_id) ? role_id : [role_id]).filter(
    (id) => typeof id === "string" && id.trim().length > 0,
  );
  if (ids.length === 0) return;
  await Promise.all(
    ids.map((rid) =>
      request.post(`/users/${encodeURIComponent(uid)}/roles`, {
        role_id: rid,
      }),
    ),
  );
};

/** 收回单个角色，见 docs/api/user.md「为用户收回角色」 */
export const revokeUserRoleApi = async (
  uid: string,
  role_id: string,
): Promise<void> => {
  await request.delete(
    `/users/${encodeURIComponent(uid)}/roles/${encodeURIComponent(role_id)}`,
  );
};

/** 根据目标角色集合计算需收回、需授予的角色 id */
export const diffRoleIds = (
  previousRoleIds: string[],
  nextRoleIds: string[],
): { toRemove: string[]; toAdd: string[] } => {
  const prev = new Set(previousRoleIds);
  const next = new Set(nextRoleIds);
  return {
    toRemove: [...prev].filter((id) => !next.has(id)),
    toAdd: [...next].filter((id) => !prev.has(id)),
  };
};

/**
 * 将用户角色同步为指定集合：先并行收回多余角色，再并行授予新增角色。
 * 与目标一致时不会产生请求。
 */
export const syncUserRolesToTargetApi = async (
  uid: string,
  previousRoleIds: string[],
  nextRoleIds: string[],
): Promise<void> => {
  const { toRemove, toAdd } = diffRoleIds(previousRoleIds, nextRoleIds);
  if (toRemove.length === 0 && toAdd.length === 0) return;
  await Promise.all(toRemove.map((rid) => revokeUserRoleApi(uid, rid)));
  if (toAdd.length > 0) {
    await assignUserRoleApi(uid, toAdd);
  }
};

export const getPermissionsApi = async (): Promise<PermissionItem[]> => {
  return permissions as unknown as PermissionItem[];
};

/** 管理员创建用户，见 docs/api/user.md「管理员添加新用户」；响应体为新用户 Profile */
export const createUserApi = async (
  data: UserCreateInput,
): Promise<UserTypes.Profile> => {
  //先通过手机号查找，如果存在，直接更新角色即可
  const result = await listUsersApi({ phone: data.phone });
  if (result.users.length > 0) {
    const user = result.users[0];
    if (user && user?.roles && user?.roles?.length > 0) {
      throw new Error("用户已存在");
    } else {
      return user as unknown as UserTypes.Profile;
    }
  } else {
    const res = await request.post("/users", data);
    return res as unknown as UserTypes.Profile;
  }
};
