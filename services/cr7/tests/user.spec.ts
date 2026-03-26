import {
    loadFeature,
    describeFeature,
    StepTest,
    FeatureDescriibeCallbackParams
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, Mock, vi, TestContext } from 'vitest';
import { User } from '@cr7/types';
import { handler as initAdminHandler } from "@/scripts/user/init-admin.js";
import { mockWechatServer, MockServer } from './lib/server.js';
import {
    assertLoginResponse,
    assertUserProfile,
    changePassword,
    grantRoleToUser,
    getUserProfile,
    passwordLogin,
    prepareAdminUser,
    registerUser,
    wechatMiniLogin
} from './fixtures/user.js';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import { assertAPIError } from './lib/api.js';

const schema = 'test_wechat';
const services = ['api', 'user'];

const feature = await loadFeature('./tests/features/user.feature');

interface ScenarioContext {
    fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
}

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
    expect(lastError).toBeTruthy();
    return assertAPIError(lastError, options);
}

describeFeature(feature, ({
    Scenario, BeforeAllScenarios, AfterAllScenarios,
    context: scenarioContext
}: FeatureDescriibeCallbackParams<ScenarioContext>) => {
    function requireAdminIdentity(context: AdminIdentityContext) {
        expect(context.adminCountryCode).toBeTruthy();
        expect(context.adminPhone).toBeTruthy();
        expect(context.adminName).toBeTruthy();
        return {
            adminCountryCode: context.adminCountryCode!,
            adminPhone: context.adminPhone!,
            adminName: context.adminName!,
        };
    }

    function requireAdminLoginResponse(
        context: Pick<AdminLoginContext, 'adminLoginResponse'>,
    ) {
        expect(context.adminLoginResponse).toBeTruthy();
        return context.adminLoginResponse!;
    }

    function requireNewPasswordLoginResponse(
        context: Pick<AdminLoginContext, 'newPasswordLoginResponse'>,
    ) {
        expect(context.newPasswordLoginResponse).toBeTruthy();
        return context.newPasswordLoginResponse!;
    }

    function requireUserProfile(context: UserProfileContext) {
        expect(context.userProfile).toBeTruthy();
        return context.userProfile!;
    }

    function requireAdminProfile(context: AdminProfileContext) {
        expect(context.adminProfile).toBeTruthy();
        return context.adminProfile!;
    }

    function requireAdminInitialPassword(context: AdminPasswordContext) {
        expect(context.adminInitialPassword).toBeTruthy();
        return context.adminInitialPassword!;
    }

    function requireOperatorAdminToken(context: OperatorAdminContext) {
        expect(context.adminToken).toBeTruthy();
        return context.adminToken!;
    }

    function requireOperatorUserProfile(context: OperatorUserContext) {
        expect(context.userProfile).toBeTruthy();
        return context.userProfile!;
    }

    function requireGrantRoleResponse(context: GrantRoleResultContext) {
        expect(context.grantRoleResponse).toBeTruthy();
        return context.grantRoleResponse!;
    }

    async function loginAdmin(
        context: AdminIdentityContext & AdminLoginContext,
        password: string,
        targetKey: 'adminLoginResponse' | 'newPasswordLoginResponse' = 'adminLoginResponse',
    ) {
        const { apiServer } = scenarioContext.fixtures.values;
        const { adminCountryCode, adminPhone } = requireAdminIdentity(context);
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
        const fixtures = await useFixtures(
            { ...services_fixtures, schema, services },
            ['apiServer']
        );
        Object.assign(scenarioContext, { fixtures });
    });

    AfterAllScenarios(async () => {
        await scenarioContext.fixtures.close();
    });

    Scenario('wechat user login', (s: StepTest<WechatMockContext & LoginResponseContext & UserProfileContext>) => {
        const { Given, When, Then, context } = s;
        Given('wechat mini app', async function () {
            const mockCode2SessionResponse = vi.fn();
            const mock_wechat_server = await mockWechatServer(mockCode2SessionResponse);
            const { address } = mock_wechat_server;
            vi.spyOn(config.wechat, 'base_url', 'get').mockReturnValue(address);
            Object.assign(context, { mockCode2SessionResponse, mock_wechat_server });
        });

        When(
            `wechat user_{int} first open`,
            async (ctx, user: number) => {
                const { mockCode2SessionResponse } = context;
                const { apiServer } = scenarioContext.fixtures.values;

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

        Then('register as a new user', async function () {
            const { loginResponse } = context;
            const { values: { apiServer } } = scenarioContext.fixtures;
            assertLoginResponse(loginResponse);
            const { token } = loginResponse;
            const profile = await getUserProfile(apiServer, token);
            assertUserProfile(profile);

            Object.assign(context, { userProfile: profile });
        });

        When(`wechat user_{int} open again`, async function (ctx, user: number) {
            const { mockCode2SessionResponse } = context;
            const { apiServer } = scenarioContext.fixtures.values;

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

        Then('login successfully and get user profile', async function () {
            const { loginResponse } = context;
            const previousProfile = requireUserProfile(context);
            const { values: { apiServer } } = scenarioContext.fixtures;

            assertLoginResponse(loginResponse);
            const { token } = loginResponse;
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

            const { apiServer } = scenarioContext.fixtures.values;
            const { profile: adminProfile } = await prepareAdminUser(apiServer, schema, phone);
            Object.assign(context, { adminProfile });
        });

        Then('管理员账号创建成功', () => {
            expect(requireAdminProfile(context)).toBeTruthy();
        });

        And('管理员账号的手机号为 {string} {string}', (ctx, countryCode: string, phone: string) => {
            expect(requireAdminProfile(context).phone).toBe(`${countryCode} ${phone}`);
        });

        And('管理员的用户名默认为 "system admin"', () => {
            expect(requireAdminProfile(context).name).toBe('system admin');
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
            await loginAdmin(context, requireAdminInitialPassword(context));
        });

        Then('登录成功并获取管理员用户信息', async () => {
            const { apiServer } = scenarioContext.fixtures.values;
            const loginResponse = requireAdminLoginResponse(context);
            const { adminCountryCode, adminPhone, adminName } = requireAdminIdentity(context);
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
            const { apiServer } = scenarioContext.fixtures.values;
            const passwordChangeResponse = await changePassword(
                apiServer,
                requireAdminLoginResponse(context).token,
                requireAdminInitialPassword(context),
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
            const { apiServer } = scenarioContext.fixtures.values;
            const profile = await getUserProfile(apiServer, requireNewPasswordLoginResponse(context).token);
            assertUserProfile(profile);
            const { adminCountryCode, adminPhone, adminName } = requireAdminIdentity(context);
            expect(profile.name).toBe(adminName);
            expect(profile.phone).toBe(`${adminCountryCode} ${adminPhone}`);
            expect(profile.openid).toBeNull();
            expect(profile.auth_methods ?? []).toContain('PASSWORD');
        });

        And('管理员账号 {string} 使用旧密码 {string} 登录失败', async (ctx, name: string, oldPassword: string) => {
            expect(context.adminName).toBe(name);
            const { apiServer } = scenarioContext.fixtures.values;
            try {
                const { adminCountryCode, adminPhone } = requireAdminIdentity(context);
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
            const { apiServer } = scenarioContext.fixtures.values;
            const { token, profile } = await prepareAdminUser(apiServer, schema, `admin_${adminName}`);
            Object.assign(context, { adminToken: token, adminProfile: profile });
        });

        Given('用户 {string} 已注册并登录', async (ctx, userName: string) => {
            const { apiServer } = scenarioContext.fixtures.values;
            const token = await registerUser(apiServer, userName);
            const profile = await getUserProfile(apiServer, token);
            Object.assign(context, { userToken: token, userProfile: profile });
        });

        When('管理员账号 {string} 将用户 {string} 设置成运营人员', async () => {
            const { apiServer } = scenarioContext.fixtures.values;
            const grantRoleResponse = await grantRoleToUser(
                apiServer,
                requireOperatorAdminToken(context),
                requireOperatorUserProfile(context).id,
                'OPERATOR',
            );
            Object.assign(context, { grantRoleResponse });
        });

        Then('用户 {string} 的角色包含 {string}', (_ctx, userName: string, roleLabel: string) => {
            expect(roleLabel).toBe('operator');
            expect(requireGrantRoleResponse(context).role_names).toContain('OPERATOR');
        });
    });
});