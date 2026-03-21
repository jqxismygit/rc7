import {
    loadFeature, describeFeature, StepTest,
    FeatureDescriibeCallbackParams
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, Mock, vi, TestContext } from 'vitest';
import { User } from '@cr7/types';
import { mockWechatServer, MockServer } from './lib/server.js';
import {
    assertLoginResponse, assertUserProfile,
    getUserProfile, wechatMiniLogin
} from './fixtures/user.js';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';

const schema = 'test_wechat';
const services = ['api', 'user'];

const feature = await loadFeature('./tests/features/user.feature');

interface ScenarioContext {
    fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
}

describeFeature(feature, ({
    Scenario, BeforeAllScenarios, AfterAllScenarios,
    context: scenarioContext
}: FeatureDescriibeCallbackParams<ScenarioContext>) => {
    interface WechatContext extends TestContext{
        mockCode2SessionResponse: Mock;
        mock_wechat_server: MockServer;
        loginResponse?: { token: string };
        userProfile: User.Profile;
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
        Given('wechat mini app', async function() {
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

        Then('register as a new user', async function() {
            const { loginResponse } = context;
            const { values: { apiServer } } = scenarioContext.fixtures;
            assertLoginResponse(loginResponse);
            const { token } = loginResponse;
            const profile = await getUserProfile(apiServer, token);
            assertUserProfile(profile);

            Object.assign(context, { userProfile: profile });
        });

        When(`wechat user_{int} open again`, async function(ctx, user: number) {
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

        Then('login successfully and get user profile', async function() {
            const { loginResponse, userProfile: previousProfile } = context;
            const { values: { apiServer } } = scenarioContext.fixtures;

            assertLoginResponse(loginResponse);
            const { token } = loginResponse;
            const profile = await getUserProfile(apiServer, token);
            assertUserProfile(profile);

            expect(profile.openid).toBe(previousProfile?.openid);
        });
    });

    Scenario('初始化系统管理员账号', ({ Given, Then, And }) => {
        Given('使用 cli 初始化管理员账号，指定手机号 12345678901，密码为 "pass_test"', () => {});
        Then('管理员账号创建成功', () => {});
        And('管理员账号的手机号为 +86 12345678901', () => {});
        And('管理员的用户名默认为 "system admin"', () => {});
    });

    Scenario('管理员账号登录', ({ Given, When, Then }) => {
        Given('管理员账号 "system admin" 已创建，密码为 "pass_test"', () => {});
        When('管理员账号 "system admin" 登录', () => {});
        Then('登录成功并获取管理员用户信息', () => {});
    });

    Scenario('管理员账号修改密码', ({ Given, When, Then, And }) => {
        Given('管理员账号 "system admin" 已登录', () => {});
        When('管理员账号 "system admin" 修改密码为 "newpassword"', () => {});
        Then('密码修改成功', () => {});
        And('管理员账号 "system admin" 使用新密码 "newpassword" 登录成功', () => {});
        And('管理员账号 "system admin" 使用旧密码 "pass_test" 登录失败', () => {});
    });
});