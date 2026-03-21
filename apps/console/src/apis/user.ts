import { request } from "@/utils/request";

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
