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
  updateUserProfile,
  wechatBindPhone,
  wechatMiniLogin
} from './fixtures/user.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';

const schema = 'test_wechat';
const services = ['api', 'user', 'wechat'];

const feature = await loadFeature('./tests/features/user.feature');

type LoginResponse = { token: string };

type LoginResponseContext = {
  loginResponse: LoginResponse;
  userProfile: User.Profile;
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

interface FeatureContext extends
  Partial<LoginResponseContext> {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
  mockWechatReqHandler: Mock;
}


const openedMockServers: MockServer[] = [];
const openedSpies: MockInstance[] = [];

describeFeature(feature, ({
  Scenario,
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  defineSteps,
  Background,
  context: featureContext
}: FeatureDescriibeCallbackParams<FeatureContext>) => {

  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    await bootstrap();

    const mockWechatReqHandler = vi.fn()
    .mockImplementationOnce(async ({ path }) => {
      if (path === '/cgi-bin/token') {
        return {
          access_token: 'default_test_token',
          expires_in: 7200,
        };
      }

      return Promise.reject(
        new Error(`Unexpected request to mock wechat server with path: ${path}`)
      );
    });

    const mock_wechat_server = await mockWechatServer(mockWechatReqHandler);

    const wechatServerSpy = vi
    .spyOn(config.wechat, 'base_url', 'get')
    .mockReturnValue(mock_wechat_server.address);

    await migrate({ schema });
    const broker = await prepareServices(services);
    await broker.start();
    featureContext.broker = broker;
    featureContext.apiServer = await prepareAPIServer(broker);
    featureContext.mockWechatReqHandler = mockWechatReqHandler;

    openedSpies.push(wechatServerSpy);
    openedMockServers.push(mock_wechat_server);
  });

  AfterAllScenarios(async () => {
    const { broker } = featureContext;
    await broker.stop();

    while (openedMockServers.length > 0) {
      const server = openedMockServers.pop();
      if (server) {
        server.close();
      }
    }
  });

  AfterEachScenario(async () => {
    await dropSchema({ schema });

    featureContext.mockWechatReqHandler.mockReset();
    for (const [key] of Object.entries(featureContext)) {
      if (['broker', 'apiServer', 'mockWechatReqHandler'].includes(key)) {
        continue;
      }
      Object.assign(featureContext, { [key]: undefined });
    }
  });

  defineSteps(({ When, Then }) => {
    When(
      '微信用户 {string} 首次打开小程序',
      async (_ctx, user: string) => {
        const { apiServer, mockWechatReqHandler } = featureContext;
        mockWechatReqHandler.mockResolvedValue({
          openid: `openid_${user}`,
          session_key: `session_key_${user}`,
        });

        const code = `code_${user}`;
        featureContext.loginResponse = await wechatMiniLogin(apiServer, code);

        const { appid, secret, } = config.wechat;
        expect(mockWechatReqHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: null,
            query: expect.objectContaining({
              appid, secret, js_code: code, grant_type: 'authorization_code'
            })
          })
        );
      }
    );

    Then('注册为新用户', async function () {
      const { apiServer, loginResponse } = featureContext;
      assertLoginResponse(loginResponse);
      const { token } = loginResponse!;
      const profile = await getUserProfile(apiServer, token);
      assertUserProfile(profile);

      featureContext.userProfile = profile;
    });

    When('用户获取新的个人信息', async () => {
      const { apiServer, loginResponse } = featureContext;
      const profile = await getUserProfile(apiServer, loginResponse!.token);
      assertUserProfile(profile);
      featureContext.userProfile = profile;
    });

  });

  Background(({ Given }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });
  })

  Scenario('微信用户登录', (s: StepTest<LoginResponseContext>) => {
    const { When, Then, context } = s;

    When(`微信用户 {string} 再次打开小程序`, async function (_ctx, user: string) {
      const { apiServer, mockWechatReqHandler } = featureContext;

      mockWechatReqHandler.mockResolvedValue({
        openid: `openid_${user}`,
        session_key: `session_key_${user}_new`,
      });

      const code = `code_${user}_again`;
      const loginResponse = await wechatMiniLogin(apiServer, code);

      const { appid, secret } = config.wechat;
      expect(mockWechatReqHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: null,
        query: expect.objectContaining({
          appid, secret, js_code: code, grant_type: 'authorization_code'
        })
      }));

      context.loginResponse = loginResponse;
    });

    Then('登录成功并获取用户信息', async function () {
      const { loginResponse } = context;
      const { apiServer, userProfile: previousProfile } = featureContext;

      assertLoginResponse(loginResponse);
      const { token } = loginResponse!;
      const profile = await getUserProfile(apiServer, token);
      assertUserProfile(profile);

      expect(profile.openid).toBe(previousProfile!.openid);
    });
  });

  Scenario('用户更新个人信息', (s: StepTest<{
    newName: string;
    newAvatar: string;
    newProfile: Record<string, string | number>;
    updateProfileResponse: null;
  }>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户新名称为 {string}', (_ctx, name: string) => {
      context.newName = name;
    });

    And('用户新的头像 {string}', (_ctx, avatar: string) => {
      context.newAvatar = avatar;
    });

    And('用户新的 profile 中有 {string}，值为 {string}', (_ctx, key: string, value: string) => {
      context.newProfile = context.newProfile ?? {};
      context.newProfile[key] = value;
    });

    And('用户新的 profile 中有 {string}，值为 {number}', (_ctx, key: string, value: number) => {
      context.newProfile = context.newProfile ?? {};
      context.newProfile[key] = value;
    });

    When('用户更新个人信息', async () => {
      const { apiServer, loginResponse } = featureContext;
      const response = await updateUserProfile(
        apiServer, loginResponse!.token,
        {
          name: context.newName,
          avatar: context.newAvatar,
          profile: context.newProfile,
        }
      );
      context.updateProfileResponse = response;
    });

    Then('用户信息更新成功', () => {
      expect(context.updateProfileResponse).toBeNull();
    });

    Then('用户信息名称为 {string}', (_ctx, expectedName: string) => {
      expect(featureContext.userProfile!.name).toBe(expectedName);
    });

    And('用户信息头像为 {string}', (_ctx, expectedAvatar: string) => {
      expect(featureContext.userProfile!.avatar).toBe(expectedAvatar);
    });

    And('用户信息 profile 中 {string} 的值为 {string}', (_ctx, key: string, expectedValue: string) => {
      expect(featureContext.userProfile!.profile[key]).toBe(expectedValue);
    });

    And('用户信息 profile 中 {string} 的值为 {number}', (_ctx, key: string, expectedValue: number) => {
      expect(featureContext.userProfile!.profile[key]).toBe(expectedValue);
    });
  });

  Scenario('微信用户绑定手机号', (s: StepTest<{
    phoneBindCode: string; countryCode: string;
    userProfile: User.Profile;
  }>) => {
    const { When, Then, And, context } = s;

    When(
      '用户点击手机号授权, 国家码为 {string}，手机号为 {string}',
      async (_ctx, countryCode: string, phone: string) => {
      const { apiServer, mockWechatReqHandler, loginResponse } = featureContext;
      const phoneBindCode = 'phone_bind_code_1';

      mockWechatReqHandler.mockResolvedValueOnce({
        errcode: 0,
        errmsg: 'ok',
        phone_info: {
          phoneNumber: phone,
          purePhoneNumber: phone,
          countryCode: countryCode,
        },
      });
      await wechatBindPhone(apiServer, loginResponse!.token, phoneBindCode);

      context.phoneBindCode = phoneBindCode;
    });

  Then('微信服务端返回用户的手机号信息', async () => {
      const { mockWechatReqHandler } = featureContext;
      await vi.waitFor(() => {
        expect(mockWechatReqHandler).toHaveBeenCalledTimes(2);
      });
    });

    Then('微信用户已经与手机号绑定', async () => {
      const { apiServer, loginResponse } = featureContext;
      const profile = await getUserProfile(apiServer, loginResponse!.token);
      context.userProfile = profile;
    });

    And('获取到的用户信息包含手机号，国家码为 {string}，手机号为 {string}', (
      _ctx,
      countryCode: string,
      phone: string,
    ) => {
      expect(context.userProfile!.phone).toBe(`+${countryCode} ${phone}`);
    });
  });

  Scenario('初始化系统管理员账号', (s: StepTest<{
    userProfile: User.Profile;
  }>) => {
    const { Given, Then, And, context } = s;

    Given(
      '使用 cli 初始化管理员账号，指定手机号 {string}，密码为 {string}',
      async (ctx, phone: string, password: string) => {

      const { apiServer } = featureContext;
      const { profile: adminProfile } = await prepareAdminUser(apiServer, schema, phone);
      context.userProfile = adminProfile;
    });

    Then('管理员账号创建成功', () => {
    });

    And('管理员账号的手机号为 {string} {string}', (ctx, countryCode: string, phone: string) => {
      expect(context.userProfile!.phone).toBe(`${countryCode} ${phone}`);
    });

    And('管理员的用户名默认为 "system admin"', () => {
      expect(context.userProfile!.name).toBe('system admin');
    });
  });

  Scenario('管理员账号登录', (s: StepTest<{
    phone: string;
    countryCode: string;
    password: string;
    token: string;
  }>) => {
    const { Given, When, Then, And, context } = s;

    Given('管理员账号已创建，手机号为 {string}，密码为 {string}', async (_ctx, phone: string, password: string) => {
      context.password = password;
      context.phone = phone;
      const countryCode = '+86';
      context.countryCode = countryCode;
      await initAdminHandler({ schema, countryCode, phone, password });
    });

    When('管理员使用账号 {string} 密码 {string} 登录', async (_ctx, phone: string, password: string) => {
      const countryCode = '+86';
      const { apiServer } = featureContext;
      const { token } = await passwordLogin(apiServer, countryCode, phone, password);
      context.token = token;
    });

    Then('登录成功并获取管理员用户信息', async () => {
      const { apiServer } = featureContext;
      const { token } = context;
      const profile = await getUserProfile(apiServer, token);
      assertUserProfile(profile);
      const { countryCode, phone } = context;
      expect(profile.phone).toBe(`${countryCode} ${phone}`);
      expect(profile.openid).toBeNull();
      expect(profile.auth_methods ?? []).toContain('PASSWORD');
    });

    When('管理员账号修改密码为 {string}', async (ctx, newPassword: string) => {
      const { apiServer } = featureContext;
      const { token, password } = context;
      await changePassword(apiServer, token, password, newPassword);
    });

    Then('管理员账号使用新密码 {string} 登录成功', async (ctx, newPassword: string) => {
      const { apiServer } = featureContext;
      const { countryCode, phone } = context;
      await expect(
        passwordLogin(apiServer, countryCode!, phone!, newPassword)
      ).resolves.toHaveProperty('token');
    });

    And('管理员账号使用旧密码 {string} 登录失败', async (ctx, oldPassword: string) => {
      const { apiServer } = featureContext;
      const { countryCode, phone } = context;
      await expect(
        passwordLogin(apiServer, countryCode!, phone!, oldPassword)
      ).rejects.toHaveProperty('status', 401);
    });
  });

  Scenario(
    '管理员可以将其他用户设置成运营人员',
    (s: StepTest<OperatorAdminContext & OperatorUserContext & GrantRoleResultContext>) => {
      const { Given, When, Then, context } = s;

      Given('管理员账号已登录', async (ctx, adminName: string) => {
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

      When('管理员账号将用户 {string} 设置成运营人员', async () => {
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
      { userList: User.UserListResult }
    >) => {
      const { Given, When, Then, And, context } = s;

      Given(
        '管理员账号已登录，手机号为 {string}',
        async (ctx, phone: string) => {
        const password = 'pass_test';
        await initAdminHandler({ schema, phone, password });
        const { token } = await passwordLogin(featureContext.apiServer, '+86', phone, password);
        featureContext.adminToken = token;
      });

      When('管理员账号获取用户列表', async (ctx, name: string) => {
        const { apiServer, adminToken } = featureContext;
        const userListResponse = await listUsers(apiServer, adminToken);
        context.userList = userListResponse;
      });

      Then('用户列表分页信息为 page {number}、limit {number}', (_ctx, page: number, limit: number) => {
        const { userList } = context;
        expect(userList.page).toBe(page);
        expect(userList.limit).toBe(limit);
        expect(userList.total).toBeGreaterThan(0);
      });

      Then(
        '用户列表获取成功，用户列表包含手机号为 {string}，国别码 {string} 的用户',
        (_ctx, phone: string, countryCode: string) => {
          const { userList } = context;
          expect(userList.users.some(user => user.phone === `+${countryCode} ${phone}`)).toBe(true);
      });

      When('管理员用手机号 {string} 搜索用户列表', async (ctx, phone: string) => {
        const { apiServer, adminToken } = featureContext;
        const searchedUserListResponse = await listUsers(apiServer, adminToken, { phone });
        context.userList = searchedUserListResponse;
      });

      Then(
        '用户列表搜索成功，用户列表包含手机号为 {string}，国别码 {string} 的用户',
        (_ctx, phone: string, countryCode: string) => {
          const { userList } = context;
          expect(userList.users.some(user => user.phone === `+${countryCode} ${phone}`)).toBe(true);
      });
    }
  );
});