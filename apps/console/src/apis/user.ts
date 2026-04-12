import type { User as UserTypes } from "@cr7/types";
import { request } from "@/utils/request";
import permissions from "@/permissions.json";
import type { PermissionItem, PermissionType } from "@/types";

export type UserListQuery = {
  phone?: string;
  role_id?: string;
  page?: number;
  limit?: number;
};

export type UserCreateInput = Pick<UserTypes.Profile, "name"> &
  Pick<UserTypes.PhoneBinding, "phone"> & {
    country_code?: UserTypes.PhoneBinding["country_code"];
    password: string;
  };

export const listUsersApi = async (
  params?: UserListQuery,
): Promise<UserTypes.UserListResult> => {
  const res = await request.get("/users", { params });
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
  console.log("getRolesApi ===>>", res);
  return res as unknown as UserTypes.Role[];
};

export const getPermissionsApi = async (): Promise<PermissionItem[]> => {
  return permissions as unknown as PermissionItem[];
};

export const createUserApi = async (data: UserCreateInput): Promise<void> => {
  await request.post("/user", data);
};
