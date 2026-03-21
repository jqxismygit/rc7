import {
    loadFeature,
    describeFeature,
    StepTest,
    FeatureDescriibeCallbackParams
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, Mock, vi, TestContext } from 'vitest';
import { User } from '@cr7/types';
import { mockWechatServer, MockServer } from './lib/server.js';
import {
    assertLoginResponse,
    assertUserProfile,
    changePassword,
    getUserProfile,
    passwordLogin,
    wechatMiniLogin
} from './fixtures/user.js';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import { assertAPIError } from './lib/api.js';
import { handler as initAdminHandler } from '@/scripts/user/init-admin.js';

const schema = 'test_wechat';
const services = ['api', 'user'];

const feature = await loadFeature('./tests/features/user.feature');

interface ScenarioContext {
    fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
}

type LoginResponse = { token: string };

function rememberError(context: Record<string, unknown>, error: unknown) {
    Object.assign(context, { lastError: error });
}

function assertLastAPIError(
    context: Record<string, unknown>,
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
    interface WechatContext extends TestContext {
        mockCode2SessionResponse: Mock;
        mock_wechat_server: MockServer;
        loginResponse?: LoginResponse;
        userProfile: User.Profile;
    }

    interface AdminContext extends TestContext {
        adminCountryCode?: string;
        adminPhone?: string;
        adminName?: string;
        adminInitialPassword?: string;
        adminUpdatedPassword?: string;
        adminProfile?: User.Profile;
        adminLoginResponse?: LoginResponse;
        newPasswordLoginResponse?: LoginResponse;
        passwordChangeResponse?: null;
        lastError?: unknown;
    }

    async function initAdminByCli(phone: string, password: string) {
        return initAdminHandler({
            schema,
            phone,
            password,
            countryCode: '+86',
        });
    }

    async function loginAdmin(
        context: Partial<AdminContext>,
        password: string,
        targetKey: 'adminLoginResponse' | 'newPasswordLoginResponse' = 'adminLoginResponse',
    ) {
        const { apiServer } = scenarioContext.fixtures.values;
        const loginResponse = await passwordLogin(
            apiServer,
            context.adminCountryCode ?? '+86',
            context.adminPhone ?? '',
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

    Scenario('wechat user login', ({ Given, When, Then, context }: StepTest<WechatContext>) => {
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
            const { loginResponse, userProfile: previousProfile } = context;
            const { values: { apiServer } } = scenarioContext.fixtures;

            assertLoginResponse(loginResponse);
            const { token } = loginResponse;
            const profile = await getUserProfile(apiServer, token);
            assertUserProfile(profile);

            expect(profile.openid).toBe(previousProfile?.openid);
        });
    });

    Scenario('初始化系统管理员账号', (s: StepTest<Partial<AdminContext>>) => {
        const { Given, Then, And, context } = s;

        Given('使用 cli 初始化管理员账号，指定手机号 {string}，密码为 {string}', async (ctx, phone: string, password: string) => {
            Object.assign(context, {
                adminCountryCode: '+86',
                adminPhone: phone,
                adminInitialPassword: password,
                adminName: 'system admin',
            });

            await initAdminByCli(phone, password);
            const loginResponse = await loginAdmin(context, password);
            const { apiServer } = scenarioContext.fixtures.values;
            const adminProfile = await getUserProfile(apiServer, loginResponse.token);
            Object.assign(context, { adminProfile });
        });

        Then('管理员账号创建成功', () => {
            expect(context.adminProfile).toBeTruthy();
        });

        And('管理员账号的手机号为 {string} {string}', (ctx, countryCode: string, phone: string) => {
            expect(context.adminProfile!.phone).toBe(`${countryCode} ${phone}`);
        });

        And('管理员的用户名默认为 "system admin"', () => {
            expect(context.adminProfile!.name).toBe('system admin');
        });
    });

    Scenario('管理员账号登录', (s: StepTest<Partial<AdminContext>>) => {
        const { Given, When, Then, context } = s;

        Given('管理员账号 {string} 已创建，手机号为 {string}，密码为 {string}', async (ctx, name: string, phone: string, password: string) => {
            Object.assign(context, {
                adminCountryCode: '+86',
                adminName: name,
                adminPhone: phone,
                adminInitialPassword: password,
            });

            await initAdminByCli(phone, password);
        });

        When('管理员账号 {string} 登录', async (ctx, name: string) => {
            expect(context.adminName).toBe(name);
            await loginAdmin(context, context.adminInitialPassword!);
        });

        Then('登录成功并获取管理员用户信息', async () => {
            const { apiServer } = scenarioContext.fixtures.values;
            const loginResponse = context.adminLoginResponse!;
            const profile = await getUserProfile(apiServer, loginResponse.token);
            assertUserProfile(profile);
            expect(profile.name).toBe(context.adminName);
            expect(profile.phone).toBe(`${context.adminCountryCode} ${context.adminPhone}`);
            expect(profile.openid).toBeNull();
            expect(profile.auth_methods ?? []).toContain('PASSWORD');
        });
    });

    Scenario('管理员账号修改密码', (s: StepTest<Partial<AdminContext>>) => {
        const { Given, When, Then, And, context } = s;

        Given('管理员账号 {string} 已登录，手机号为 {string}，密码为 {string}', async (ctx, name: string, phone: string, password: string) => {
            Object.assign(context, {
                adminCountryCode: '+86',
                adminName: name,
                adminPhone: phone,
                adminInitialPassword: password,
            });

            await initAdminByCli(phone, password);
            await loginAdmin(context, password);
        });

        When('管理员账号 {string} 修改密码为 {string}', async (ctx, name: string, newPassword: string) => {
            expect(context.adminName).toBe(name);
            Object.assign(context, { adminUpdatedPassword: newPassword });
            const { apiServer } = scenarioContext.fixtures.values;
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
            const { apiServer } = scenarioContext.fixtures.values;
            const profile = await getUserProfile(apiServer, context.newPasswordLoginResponse!.token);
            assertUserProfile(profile);
            expect(profile.name).toBe(context.adminName);
            expect(profile.phone).toBe(`${context.adminCountryCode} ${context.adminPhone}`);
            expect(profile.openid).toBeNull();
            expect(profile.auth_methods ?? []).toContain('PASSWORD');
        });

        And('管理员账号 {string} 使用旧密码 {string} 登录失败', async (ctx, name: string, oldPassword: string) => {
            expect(context.adminName).toBe(name);
            const { apiServer } = scenarioContext.fixtures.values;
            try {
                await passwordLogin(apiServer, context.adminCountryCode!, context.adminPhone!, oldPassword);
            } catch (error) {
                rememberError(context as Record<string, unknown>, error);
            }

            assertLastAPIError(context as Record<string, unknown>, {
                status: 401,
                messageIncludes: '手机号或密码错误',
                method: 'POST',
            });
        });
    });
});