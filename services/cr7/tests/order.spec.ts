import {
  loadFeature, describeFeature,
  FeatureDescriibeCallbackParams
} from "@amiceli/vitest-cucumber"
import config from 'config';
import { vi } from 'vitest';
import { useFixtures, FixturesResult } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import { registerUser } from './fixtures/user.js';

const schema = 'test_order';
const services = ['api', 'user'];

const feature = await loadFeature('tests/features/order.feature')

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  userToken: string;
}

describeFeature(feature, ({
  BeforeAllScenarios, AfterAllScenarios,
  BeforeEachScenario, AfterEachScenario,
  Background, Scenario,
  context: scenarioContext
}: FeatureDescriibeCallbackParams<ScenarioContext>) => {

  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    const fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer']
    );
    Object.assign(scenarioContext, { fixtures });
  })

  AfterAllScenarios(async () => {
    await scenarioContext.fixtures.close();
  })

  BeforeEachScenario(() => {})
  AfterEachScenario(() => {})

  Background(({ Given }) => {
      Given(`用户 "Alice" 已注册并登录`, async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const token = await registerUser(apiServer, 'Alice');
        Object.assign(scenarioContext, { userToken: token });
      })
  })

  Scenario(`创建订单成功`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
      When(`用户预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      Then(`预订成功`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存剩余 1`, () => { })
  })
  Scenario(`预订超过库存数量的门票`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
      When(`用户预订 3 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      Then(`预订失败，提示库存不足`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存仍为 2`, () => { })
  })
  Scenario(`取消付款`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`用户取消订单`, () => { })
      Then(`取消成功`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存恢复为 2`, () => { })
  })
  Scenario(`订单过期未付款`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`订单过期未付款`, () => { })
      Then(`订单自动取消`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存恢复为 2`, () => { })
  })
  Scenario(`用户预订多个票种`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"、"儿童票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
      And(`场次 "2026-07-01" 的 "儿童票" 库存为 3`, () => { })
      When(`用户预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票" 和 2 张 "儿童票"`, () => { })
      Then(`预订成功`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存剩余 1`, () => { })
      And(`场次 "2026-07-01" 的 "儿童票" 库存剩余 1`, () => { })
  })

})