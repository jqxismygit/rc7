import { Server } from "http";
import { getJSON, postJSON } from "../lib/api";
import { User } from "@rc7/types";

export async function wechatMiniLogin(
  server: Server, code: string
) {
  return postJSON<{ token: string }>(
    server,
    '/user/login/wechat/mini',
    { body: { code } }
  );
}

export function getUserProfile(server: Server, token: string) {
  return getJSON<User.Profile>(server, '/user/profile', { token });
}