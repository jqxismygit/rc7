import { Server } from "http";
import { getJSON, postJSON, putJSON } from "../lib/api.js";
import { User } from "@cr7/types";
import { expect, vi } from "vitest";
import { mockWechatServer } from "../lib/server.js";
import { handler as initAdminHandler } from "@/scripts/user/init-admin.js";
import { random_text } from "../lib/random.js";

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
 * 初始化管理员账号并返回 token
 */
export async function prepareAdminToken(
  apiServer: Server,
  schema: string
): Promise<string> {

  const adminPhone = `admin_${random_text(5)}`;
  const adminPassword = 'admin_password_test';
  const admin = {
    phone: adminPhone,
    password: adminPassword,
    countryCode: '+86',
  };

  await initAdminHandler({ schema, ...admin });

  const { token } = await passwordLogin(
    apiServer,
    '+86',
    adminPhone,
    adminPassword
  );

  return token;
}

/**
 * 注册用户并返回 token
 */
export async function registerUser(
  apiServer: Server,
  userName: string = random_text(8)
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

/**
 * 为用户授予角色
 */
export async function grantRoleToUser(
  server: Server,
  token: string,
  uid: string,
  roleName: string,
) {
  return postJSON<{ role_names: string[] }>(
    server,
    `/users/${uid}/roles`,
    {
      token,
      body: { role_name: roleName },
    }
  );
}
