import { TOKEN_KEY } from "@/constants";
import axios from "axios";

/** 与 layout 退出登录一致，避免键名漂移请同步修改两处 */
const CONSOLE_USER_NAME_KEY = "errows.console.user.name";

function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CONSOLE_USER_NAME_KEY);
}

export const request = axios.create({
  baseURL: `/api`,
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuthStorage();
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  },
);
