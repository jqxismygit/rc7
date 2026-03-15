import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { User } from "@cr7/types";
import { expect, vi } from "vitest";
import { mockJSONServer } from "../lib/server.js";

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

/**
 * 注册用户并返回 token
 */
export async function registerUser(
  apiServer: Server,
  userName: string = 'Alice'
): Promise<string> {
  // 创建 mock wechat server
  const mockCode2SessionResponse = vi.fn();
  const mockWechatServer = await mockJSONServer(mockCode2SessionResponse);

  try {
    // Mock config.wechat.base_url
    const { default: config } = await import('config');
    vi.spyOn(config.wechat, 'base_url', 'get').mockReturnValue(mockWechatServer.address);

    // 模拟微信登录响应
    const code2SessionResponse = {
      openid: `openid_${userName}`,
      session_key: `session_key_${userName}`,
    };
    mockCode2SessionResponse.mockResolvedValue(code2SessionResponse);

    // 执行登录
    const code = `code_${userName}`;
    const loginResponse = await wechatMiniLogin(apiServer, code);
    assertLoginResponse(loginResponse);

    return loginResponse.token;
  } finally {
    // 用完立即关闭 mock server
    await mockWechatServer.close();
  }
}
