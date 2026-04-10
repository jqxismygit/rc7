import type { User as UserTypes } from "@cr7/types";
import { request } from "@/utils/request";

export type UserListQuery = {
  phone?: string;
  page?: number;
  limit?: number;
};

export const listUsersApi = async (
  params: UserListQuery,
): Promise<UserTypes.UserListResult> => {
  const res = await request.get("/users", { params });
  return res as unknown as UserTypes.UserListResult;
};

export type UserProfile = {
  id: string;
  name: string;
  openid: string | null;
  phone: string | null;
  auth_methods: string[];
  created_at: string;
  updated_at: string;
};

export const getProfile = async (): Promise<UserProfile> => {
  const res = await request.get("/user/profile");
  return res as unknown as UserProfile;
};

export type ChangePasswordInput = {
  current_password: string;
  new_password: string;
};

export const changePasswordApi = async (
  data: ChangePasswordInput
): Promise<void> => {
  await request.put("/user/password", data);
};
