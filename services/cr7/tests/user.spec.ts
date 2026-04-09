import {
  loadFeature,
  describeFeature,
  StepTest,
  FeatureDescriibeCallbackParams
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, Mock, vi, TestContext, MockInstance } from 'vitest';
import { User } from '@cr7/types';
import { handler as initAdminHandler } from "@/scripts/user/init-admin.js";
import { mockWechatServer, MockServer } from './lib/server.js';
import {
  assertLoginResponse,
  assertUserProfile,
  changePassword,
  listUsers,
  grantRoleToUser,
  getUserProfile,
  passwordLogin,
  prepareAdminUser,
  registerUser,
  wechatMiniLogin
} from './fixtures/user.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { assertAPIError } from './lib/api.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';

const schema = 'test_wechat';
const services = ['api', 'user'];

const feature = await loadFeature('./tests/features/user.feature');

type LoginResponse = { token: string };

type WechatMockContext = TestContext & {
  mockCode2SessionResponse: Mock;
  mock_wechat_server: MockServer;
};

type LoginResponseContext = {
  loginResponse?: LoginResponse;
};

type UserProfileContext = {
  userProfile?: User.Profile;
};

type AdminIdentityContext = TestContext & {
  adminCountryCode?: string;
  adminPhone?: string;
  adminName?: string;
};

type AdminPasswordContext = {
  adminInitialPassword?: string;
  adminUpdatedPassword?: string;
};

type AdminProfileContext = {
  adminProfile?: User.Profile;
};

type AdminLoginContext = {
  adminLoginResponse?: LoginResponse;
  newPasswordLoginResponse?: LoginResponse;
};

type PasswordChangeContext = {
  passwordChangeResponse?: null;
};

type ErrorContext = {
  lastError?: unknown;
};

type OperatorAdminContext = TestContext & {
  adminToken?: string;
  adminProfile?: User.Profile;
};

type OperatorUserContext = {
  userToken?: string;
  userProfile?: User.Profile;
};

type GrantRoleResultContext = {
  grantRoleResponse?: { role_names: string[] };
};

type UserListContext = {
  userListResponse?: User.UserListResult;
  searchedUserListResponse?: User.UserListResult;
  pagedUserListResponse?: User.UserListResult;
};

interface FeatureContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
}

function rememberError(context: ErrorContext, error: unknown) {
  Object.assign(context, { lastError: error });
}

function assertLastAPIError(
  context: ErrorContext,
  options: {
    status?: number;
    messageIncludes?: string;
    method?: string;
  }
) {
  const { lastError } = context;
  return assertAPIError(lastError, options);
}

const openedMockServers: MockServer[] = [];
const openedSpies: MockInstance[] = [];

describeFeature(feature, ({
  Scenario,
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  Background,
  context: featureContext
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  async function loginAdmin(
    context: AdminIdentityContext & AdminLoginContext,
    password: string,
    targetKey:
      | 'adminLoginResponse'
      | 'newPasswordLoginResponse' = 'adminLoginResponse',
  ) {
    const { apiServer } = featureContext;
    const adminCountryCode = context.adminCountryCode!;
    const adminPhone = context.adminPhone!;
    const loginResponse = await passwordLogin(
      apiServer,
      adminCountryCode,
      adminPhone,
      password,
    );
    assertLoginResponse(loginResponse);
    Object.assign(context, { [targetKey]: loginResponse });
    return loginResponse;
  }

  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    await bootstrap();
    const broker = await prepareServices(services);
    await broker.start();
    featureContext.broker = broker;
    featureContext.apiServer = await prepareAPIServer(broker);
  });

  AfterAllScenarios(async () => {
    const { broker } = featureContext;
    if (broker) {
      await broker.stop();
    }
    vi.restoreAllMocks();
  });

  AfterEachScenario(async () => {
    await dropSchema({ schema });
    while (openedMockServers.length > 0) {
      const server = openedMockServers.pop();
      if (server) {
        server.close();
      }
    }

    while (openedSpies.length > 0) {
      const spy = openedSpies.pop();
      if (spy) {
        spy.mockRestore();
      }
    }
    for (const [key] of Object.entries(featureContext)) {
      if (['broker', 'apiServer'].includes(key)) {
        continue;
      }
      Object.assign(featureContext, { [key]: undefined });
    }
  });

  Background(({ Given }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });
  });

  Scenario('微信用户登录', (s: StepTest<WechatMockContext & LoginResponseContext & UserProfileContext>) => {
    const { Given, When, Then, context } = s;
    Given('微信小程序服务已经准备好', async function () {
      const mockCode2SessionResponse = vi.fn();
      const mock_wechat_server = await mockWechatServer(mockCode2SessionResponse);
      const { address } = mock_wechat_server;
      vi.spyOn(config.wechat, 'base_url', 'get').mockReturnValue(address);
      Object.assign(context, { mockCode2SessionResponse, mock_wechat_server });
    });

    When(
      '微信 用户_{int} 首次打开小程序',
      async (ctx, user: number) => {
        const { mockCode2SessionResponse } = context;
        const { apiServer } = featureContext;

        const code2SessionResponse = {
          openid: `openid_${user}`,
          session_key: `session_key_${user}`,
        };
        mockCode2SessionResponse.mockResolvedValue(code2SessionResponse);

        const code = `code_${user}`;
        const loginResponse = await wechatMiniLogin(apiServer, code);

        const { appid, secret, } = config.wechat;
        expect(mockCode2SessionResponse).toHaveBeenCalledWith({
          body: null,
          query: expect.objectContaining({
            appid, secret, js_code: code, grant_type: 'authorization_code'
          })
        });

        Object.assign(context, { loginResponse });
      }
    );

    Then('注册为新用户', async function () {
      const { loginResponse } = context;
      const { apiServer } = featureContext;
      assertLoginResponse(loginResponse);
      const { token } = loginResponse!;
      const profile = await getUserProfile(apiServer, token);
      assertUserProfile(profile);

      Object.assign(context, { userProfile: profile });
    });

    When(`微信 用户_{int} 再次打开小程序`, async function (ctx, user: number) {
      const { mockCode2SessionResponse } = context;
      const { apiServer } = featureContext;

      const code2SessionResponse = {
        openid: `openid_${user}`,
        session_key: `session_key_${user}_new`,
      };
      mockCode2SessionResponse.mockResolvedValue(code2SessionResponse);

      const code = `code_${user}_again`;
      const loginResponse = await wechatMiniLogin(apiServer, code);

      const { appid, secret } = config.wechat;
      expect(mockCode2SessionResponse).toHaveBeenCalledWith({
        body: null,
        query: expect.objectContaining({
          appid, secret, js_code: code, grant_type: 'authorization_code'
        })
      });

      Object.assign(ctx, { loginResponse });
    });

    Then('登录成功并获取用户信息', async function () {
      const { loginResponse } = context;
      const previousProfile = context.userProfile!;
      const { apiServer } = featureContext;

      assertLoginResponse(loginResponse);
      const { token } = loginResponse!;
      const profile = await getUserProfile(apiServer, token);
      assertUserProfile(profile);

      expect(profile.openid).toBe(previousProfile.openid);
    });
  });

  Scenario('初始化系统管理员账号', (s: StepTest<AdminIdentityContext & AdminPasswordContext & AdminProfileContext>) => {
    const { Given, Then, And, context } = s;

    Given('使用 cli 初始化管理员账号，指定手机号 {string}，密码为 {string}', async (ctx, phone: string, password: string) => {
      Object.assign(context, {
        adminCountryCode: '+86',
        adminPhone: phone,
        adminInitialPassword: password,
        adminName: 'system admin',
      });

      const { apiServer } = featureContext;
      const { profile: adminProfile } = await prepareAdminUser(apiServer, schema, phone);
      Object.assign(context, { adminProfile });
    });

    Then('管理员账号创建成功', () => {
    });

    And('管理员账号的手机号为 {string} {string}', (ctx, countryCode: string, phone: string) => {
      expect(context.adminProfile!.phone).toBe(`${countryCode} ${phone}`);
    });

    And('管理员的用户名默认为 "system admin"', () => {
      expect(context.adminProfile!.name).toBe('system admin');
    });
  });

  Scenario('管理员账号登录', (s: StepTest<AdminIdentityContext & AdminPasswordContext & AdminLoginContext>) => {
    const { Given, When, Then, context } = s;

    Given('管理员账号 {string} 已创建，手机号为 {string}，密码为 {string}', async (ctx, name: string, phone: string, password: string) => {
      Object.assign(context, {
        adminCountryCode: '+86',
        adminName: name,
        adminPhone: phone,
        adminInitialPassword: password,
      });

      await initAdminHandler({ schema, phone, password });
    });

    When('管理员账号 {string} 登录', async (ctx, name: string) => {
      expect(context.adminName).toBe(name);
      await loginAdmin(context, context.adminInitialPassword!);
    });

    Then('登录成功并获取管理员用户信息', async () => {
      const { apiServer } = featureContext;
      const loginResponse = context.adminLoginResponse!;
      const adminCountryCode = context.adminCountryCode!;
      const adminPhone = context.adminPhone!;
      const adminName = context.adminName!;
      const profile = await getUserProfile(apiServer, loginResponse.token);
      assertUserProfile(profile);
      expect(profile.name).toBe(adminName);
      expect(profile.phone).toBe(`${adminCountryCode} ${adminPhone}`);
      expect(profile.openid).toBeNull();
      expect(profile.auth_methods ?? []).toContain('PASSWORD');
    });
  });

  Scenario('管理员账号修改密码', (
    s: StepTest<
      AdminIdentityContext
      & AdminPasswordContext
      & AdminLoginContext
      & AdminProfileContext
      & PasswordChangeContext
      & ErrorContext
    >
  ) => {
    const { Given, When, Then, And, context } = s;

    Given('管理员账号 {string} 已登录，手机号为 {string}，密码为 {string}', async (ctx, name: string, phone: string, password: string) => {
      Object.assign(context, {
        adminCountryCode: '+86',
        adminName: name,
        adminPhone: phone,
        adminInitialPassword: password,
      });

      await initAdminHandler({ schema, phone, password });
      await loginAdmin(context, password);
    });

    When('管理员账号 {string} 修改密码为 {string}', async (ctx, name: string, newPassword: string) => {
      expect(context.adminName).toBe(name);
      Object.assign(context, { adminUpdatedPassword: newPassword });
      const { apiServer } = featureContext;
      const passwordChangeResponse = await changePassword(
        apiServer,
        context.adminLoginResponse!.token,
        context.adminInitialPassword!,
        newPassword,
      );
      Object.assign(context, { passwordChangeResponse });
    });

    Then('密码修改成功', () => {
      expect(context.passwordChangeResponse).toBeNull();
    });

    And('管理员账号 {string} 使用新密码 {string} 登录成功', async (ctx, name: string, newPassword: string) => {
      expect(context.adminName).toBe(name);
      await loginAdmin(context, newPassword, 'newPasswordLoginResponse');
      const { apiServer } = featureContext;
      const profile = await getUserProfile(apiServer, context.newPasswordLoginResponse!.token);
      assertUserProfile(profile);
      const adminCountryCode = context.adminCountryCode!;
      const adminPhone = context.adminPhone!;
      const adminName = context.adminName!;
      expect(profile.name).toBe(adminName);
      expect(profile.phone).toBe(`${adminCountryCode} ${adminPhone}`);
      expect(profile.openid).toBeNull();
      expect(profile.auth_methods ?? []).toContain('PASSWORD');
    });

    And('管理员账号 {string} 使用旧密码 {string} 登录失败', async (ctx, name: string, oldPassword: string) => {
      expect(context.adminName).toBe(name);
      const { apiServer } = featureContext;
      try {
        const adminCountryCode = context.adminCountryCode!;
        const adminPhone = context.adminPhone!;
        await passwordLogin(apiServer, adminCountryCode, adminPhone, oldPassword);
      } catch (error) {
        rememberError(context, error);
      }

      assertLastAPIError(context, {
        status: 401,
        messageIncludes: '手机号或密码错误',
        method: 'POST',
      });
    });
  });

  Scenario(
    '管理员可以将其他用户设置成运营人员',
    (s: StepTest<OperatorAdminContext & OperatorUserContext & GrantRoleResultContext>) => {
      const { Given, When, Then, context } = s;

      Given('管理员账号 {string} 已登录', async (ctx, adminName: string) => {
        const { apiServer } = featureContext;
        const { token, profile } = await prepareAdminUser(apiServer, schema, `admin_${adminName}`);
        Object.assign(context, { adminToken: token, adminProfile: profile });
      });

      Given('用户 {string} 已注册并登录', async (ctx, userName: string) => {
        const { apiServer } = featureContext;
        const token = await registerUser(apiServer, userName);
        const profile = await getUserProfile(apiServer, token);
        Object.assign(context, { userToken: token, userProfile: profile });
      });

      When('管理员账号 {string} 将用户 {string} 设置成运营人员', async () => {
        const { apiServer } = featureContext;
        const grantRoleResponse = await grantRoleToUser(
          apiServer,
          context.adminToken!,
          context.userProfile!.id,
          'OPERATOR',
        );
        Object.assign(context, { grantRoleResponse });
      });

      Then('用户 {string} 的角色包含 {string}', (_ctx, userName: string, roleLabel: string) => {
        expect(roleLabel).toBe('operator');
        expect(context.grantRoleResponse!.role_names).toContain('OPERATOR');
      });
    });

  Scenario(
    '管理员可以查看用户列表',
    (s: StepTest<
      AdminIdentityContext
      & AdminPasswordContext
      & AdminLoginContext
      & UserListContext
    >) => {
      const { Given, When, Then, And, context } = s;

      Given('管理员账号 {string} 已登录，手机号为 {string}，密码为 {string}', async (ctx, name: string, phone: string, password: string) => {
        Object.assign(context, {
          adminCountryCode: '+86',
          adminName: name,
          adminPhone: phone,
          adminInitialPassword: password,
        });

        await initAdminHandler({ schema, phone, password });
        await loginAdmin(context, password);
      });

      When('管理员账号 {string} 获取用户列表', async (ctx, name: string) => {
        expect(context.adminName).toBe(name);
        const { apiServer } = featureContext;
        const userListResponse = await listUsers(
          apiServer,
          context.adminLoginResponse!.token,
          { page: 1, limit: 20 },
        );
        Object.assign(context, { userListResponse });
      });

      Then('用户列表分页信息为 page {int}、limit {int}', (_ctx, page: number, limit: number) => {
        const response = context.userListResponse!;
        expect(response.page).toBe(page);
        expect(response.limit).toBe(limit);
        expect(response.total).toBeGreaterThan(0);
      });

      Then('分页查询返回 page {int}、limit {int}', (_ctx, page: number, limit: number) => {
        const response = context.pagedUserListResponse!;
        expect(response.page).toBe(page);
        expect(response.limit).toBe(limit);
        expect(response.total).toBeGreaterThan(0);
      });

      Then('获取成功，用户列表包含用户 {string}', (_ctx, userName: string) => {
        const userList = context.userListResponse!.users;
        expect(userList.length).toBeGreaterThan(0);
        expect(userList.some(user => user.name === userName)).toBe(true);
      });

      And('{string} 的手机号为 {string} {string}', (_ctx, userName: string, countryCode: string, phone: string) => {
        const userList = context.userListResponse!.users;
        expect(
          userList.some(
            item => item.name === userName && item.phone === `${countryCode} ${phone}`,
          ),
        ).toBe(true);
      });

      When('管理员用手机号 {string} 搜索用户列表', async (ctx, phone: string) => {
        const { apiServer } = featureContext;
        const searchedUserListResponse = await listUsers(
          apiServer,
          context.adminLoginResponse!.token,
          { phone },
        );
        Object.assign(context, { searchedUserListResponse });
      });

      Then('搜索成功，用户列表包含用户 {string}', (_ctx, userName: string) => {
        const userList = context.searchedUserListResponse!.users;
        expect(userList.length).toBeGreaterThan(0);
        expect(userList.some(user => user.name === userName)).toBe(true);
      });

      And('搜索结果中 {string} 的手机号为 {string} {string}', (_ctx, userName: string, countryCode: string, phone: string) => {
        const userList = context.searchedUserListResponse!.users;
        const user = userList.find(item => item.name === userName);
        expect(user?.phone).toBe(`${countryCode} ${phone}`);
      });

      When('管理员按 page {int}、limit {int} 获取用户列表', async (_ctx, page: number, limit: number) => {
        const { apiServer } = featureContext;
        const pagedUserListResponse = await listUsers(
          apiServer,
          context.adminLoginResponse!.token,
          { page, limit },
        );
        Object.assign(context, { pagedUserListResponse, userListResponse: pagedUserListResponse });
      });

      And('分页结果数量不超过 {int}', (_ctx, maxSize: number) => {
        const userList = context.pagedUserListResponse!.users;
        expect(userList.length).toBeLessThanOrEqual(maxSize);
      });
    }
  );
});