import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { User } from "@rc7/types";
import { expect } from "vitest";

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

export function assertLoginResponse(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('token', expect.any(String));
}

export function assertUserProfile(profile: unknown) {
  expect(profile).toBeTypeOf('object');
  expect(profile).toHaveProperty('id', expect.any(String));
  expect(profile).toHaveProperty('openid', expect.any(String));
  expect(profile).toHaveProperty('created_at', expect.any(String));
  expect(profile).toHaveProperty('updated_at', expect.any(String));
}
