import { Server } from "http";
import { getJSON, postJSON, putJSON } from "../lib/api.js";
import { User } from "@cr7/types";
import { expect, vi } from "vitest";
import { mockWechatServer } from "../lib/server.js";

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

export function passwordLogin(
  server: Server,
  country_code: string,
  phone: string,
  password: string,
) {
  return postJSON<{ token: string }>(
    server,
    '/user/login/password',
    { body: { country_code, phone, password } }
  );
}

export function changePassword(
  server: Server,
  token: string,
  current_password: string,
  new_password: string,
) {
  return putJSON<null>(
    server,
    '/user/password',
    {
      token,
      body: {
        current_password,
        new_password,
      },
    }
  );
}

export function assertLoginResponse(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('token', expect.any(String));
}

export function assertUserProfile(profile: unknown) {
  expect(profile).toBeTypeOf('object');
  const userProfile = profile as User.Profile;
  expect(userProfile.id).toEqual(expect.any(String));
  if (userProfile.phone !== null) {
    expect(userProfile.phone).toBeTypeOf('string');
  } else {
    expect(userProfile.phone).toBeNull();
  }
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
  const mockServer = await mockWechatServer(mockCode2SessionResponse);

  try {
    // Mock config.wechat.base_url
    const { default: config } = await import('config');
    vi.spyOn(config.wechat, 'base_url', 'get').mockReturnValue(mockServer.address);

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
    await mockServer.close();
  }
}
