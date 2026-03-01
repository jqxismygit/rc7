import { expect, vi } from 'vitest';
import config from 'config';
import { BeforeAll, AfterAll, When, Given, Then } from '@deepracticex/vitest-cucumber';
import { mockJSONServer } from '../lib/server';
import { postJSON } from '../lib/api';
import { FixturesResult, useFixtures } from '../lib/fixtures';
import { services_fixtures } from '../fixtures/services';

const schema = 'test_wechat';
const services = ['api', 'user'];

let fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;

function assertLoginResponse(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('token', expect.any(String));
}

BeforeAll(async () => {
  fixtures = await useFixtures(
    { ...services_fixtures, schema, services },
    ['apiServer']
  );
});

AfterAll(async () => {
  await fixtures.close();
});

Given('wechat mini app', async function() {
    // 创建 mock wechat server
  this.mockCode2SessionResponse = vi.fn();
  this.mock_wechat_server = await mockJSONServer(this.mockCode2SessionResponse);
  const { address } = this.mock_wechat_server;
  vi.spyOn(config.wechat, 'base_url', 'get').mockReturnValue(address);
});

When('wechat user_{int} first open', async function (user: number) {
  const { apiServer } = fixtures.values;
  const { mockCode2SessionResponse } = this;

  const code2SessionResponse = {
    openid: `openid_${user}`,
    session_key: `session_key_${user}`,
  };
  mockCode2SessionResponse.mockResolvedValue(code2SessionResponse);

  const code = `code_${user}`;
  this.loginResponse = await postJSON(
    apiServer, '/user/login/wechat/mini',
    { body: { code } }
  );

  const { appid, secret, } = config.wechat;
  expect(mockCode2SessionResponse).toHaveBeenCalledWith({
    body: null,
    query: expect.objectContaining({
      appid, secret, js_code: code, grant_type: 'authorization_code'
    })
  });
})

Then('register as a new user', async function() {
  const { loginResponse } = this;
  assertLoginResponse(loginResponse);
});