import { request } from "@/utils/request";

export type LoginInput = {
  country_code?: string;
  phone: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export const loginApi = async (data: LoginInput): Promise<LoginResponse> => {
  const { country_code = "+86", phone, password } = data;
  const res = await request.post<LoginResponse>("/user/login/password", {
    country_code,
    phone,
    password,
  });
  return res as unknown as LoginResponse;
};
