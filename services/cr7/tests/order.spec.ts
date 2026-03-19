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
      And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      When(`用户预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      Then(`预订成功`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 1`, () => { })
    })

    Scenario(`用户预订多个票种`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"、"儿童票"`, () => { })
        And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
        And(`场次 "2026-07-01" 的 "儿童票" 库存初始为 3`, () => { })
      When(`用户预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票" 和 2 张 "儿童票"`, () => { })
      Then(`预订成功`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 1`, () => { })
      And(`场次 "2026-07-01" 的 "儿童票" 库存为 1`, () => { })
    })

    Scenario(`用户预订时同一票种重复提交会自动聚合`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
        And(`场次 "2026-07-01" 的 "成人票" 库存初始为 3`, () => { })
      When(`用户提交两条 "成人票" 订单项，数量分别为 1 和 2`, () => { })
      Then(`预订成功`, () => { })
      And(`订单中该票种数量为 3`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 0`, () => { })
  })

  Scenario(`预订超过库存数量的门票`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      When(`用户预订 3 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      Then(`预订失败，提示库存不足`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
  })

  Scenario(`取消付款`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`用户取消订单`, () => { })
      Then(`订单取消成功`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
  })

  Scenario(`订单过期未付款`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`订单过期未付款`, () => { })
      Then(`订单变为过期状态不可再付款`, () => { })
      And(`执行订单过期处理任务`, () => { })
      And(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
  })

    Scenario(`重复取消同一订单不会重复释放库存`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
        And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`用户取消订单`, () => { })
        And(`第一次取消后场次 "2026-07-01" 的 "成人票" 库存应为 2`, () => { })
      And(`用户再次取消同一订单`, () => { })
      Then(`订单取消成功`, () => { })
        And(`重复取消后场次 "2026-07-01" 的 "成人票" 库存应为 2`, () => { })
    })

    Scenario(`过期处理任务重复执行不会重复释放库存`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
        And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`订单过期未付款`, () => { })
      And(`执行订单过期处理任务`, () => { })
        And(`再次执行订单过期处理任务`, () => { })
      Then(`场次 "2026-07-01" 的 "成人票" 库存为 2`, () => { })
    })

    Scenario(`用户可以获取自己的订单详情`, ({ Given, When, Then, And }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
        And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      Given(`用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`用户查看该订单详情`, () => { })
      Then(`返回订单详情成功`, () => { })
      And(`订单包含 1 条订单项`, () => { })
      And(`订单项为 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
    })

    Scenario(`用户不能获取他人的订单详情`, ({ Given, When, Then, And }) => {
      Given(`用户 "Bob" 已注册并登录`, () => { })
      And(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
        And(`场次 "2026-07-01" 的 "成人票" 库存初始为 2`, () => { })
      And(`"Bob" 已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      When(`"Alice" 查看 "Bob" 的订单详情`, () => { })
      Then(`查看失败，提示订单不存在或无权限`, () => { })
    })

    Scenario(`用户按分页查询订单列表`, ({ Given, When, Then, And }) => {
      Given(`用户已创建 3 笔订单`, () => { })
      When(`用户按 page 1、limit 2 查询订单列表`, () => { })
      Then(`返回 2 条订单`, () => { })
      And(`total 为 3`, () => { })
      And(`page 为 1`, () => { })
      And(`limit 为 2`, () => { })
    })

    Scenario(`用户按状态筛选订单列表`, ({ Given, When, Then }) => {
      Given(`用户有待支付订单、已取消订单和已过期订单`, () => { })
      When(`用户按状态 "待付款" 查询订单列表`, () => { })
      Then(`仅返回待支付订单`, () => { })
    })

    Scenario(`用户取消已过期订单失败`, ({ Given, When, Then }) => {
      Given(`用户有一笔已过期订单`, () => { })
      When(`用户取消该订单`, () => { })
      Then(`取消失败，提示订单状态不允许取消`, () => { })
    })

    Scenario(`用户创建空订单失败`, ({ Given, When, Then }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      When(`用户提交空订单项创建订单`, () => { })
      Then(`创建失败，提示参数不合法`, () => { })
    })

    Scenario(`用户创建数量为 0 的订单项失败`, ({ Given, When, Then }) => {
      Given(`展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"`, () => { })
      When(`用户预订 0 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"`, () => { })
      Then(`创建失败，提示参数不合法`, () => { })
  })

})