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
      // 创建 mock wechat server
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

      // 保存用户信息用于后续测试
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

      // 验证是同一个用户
      expect(profile.openid).toBe(previousProfile?.openid);
    });
  });
});