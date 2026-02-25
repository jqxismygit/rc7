import { vi } from 'vitest';
import { BeforeAll, AfterAll, When, Given, Then } from '@deepracticex/vitest-cucumber';
import { mockJSONServer } from '../lib/server';
import { postJSON } from '../lib/api';
import { FixturesResult, useFixtures } from '../lib/fixtures';
import { services_fixtures } from '../fixtures/services';

let fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
BeforeAll(async () => {
  fixtures = await useFixtures(services_fixtures, ['apiServer']);
});

AfterAll(async () => {
  await fixtures.close();
});

Given('wechat mini app', async function() {
 this.mockCode2SessionResponse = vi.fn();
 this.mock_wechat_server = await mockJSONServer(this.mockCode2SessionResponse);
});

When('wechat user_{int} first open', async function (user: number) {
  const { apiServer } = fixtures.values;
  const {
    mock_wechat_server, mockCode2SessionResponse,
  } = this;

  const code2SessionResponse = {
    openid: `openid_${user}`,
    session_key: `session_key_${user}`,
  };
  mockCode2SessionResponse.mockResolvedValue(code2SessionResponse);

  const code = `code_${user}`;
  await postJSON(apiServer, '/user/wechat/mini/login', { body: { code } });

  await mock_wechat_server.close();
})

Then('register as a new user', async function() {
  throw new Error('Not implemented yet');

});