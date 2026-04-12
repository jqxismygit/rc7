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
  const res = await request.get("/user/profile");
  return res as unknown as UserTypes.Profile;
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

export const getPermissionsApi = async (): Promise<PermissionItem[]> => {
  return permissions as unknown as PermissionItem[];
};

/** 管理员创建用户，见 docs/api/user.md「管理员添加新用户」；响应体为新用户 Profile */
export const createUserApi = async (
  data: UserCreateInput,
): Promise<UserTypes.Profile> => {
  const res = await request.post("/users", data);
  return res as unknown as UserTypes.Profile;
};
