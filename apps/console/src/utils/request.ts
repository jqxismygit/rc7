import { TOKEN_KEY } from "@/constants";
import axios from "axios";

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
    return Promise.reject(error);
  },
);
