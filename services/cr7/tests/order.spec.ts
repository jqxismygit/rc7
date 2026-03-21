import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { Exhibition, Order } from '@cr7/types';
import { expect, vi } from 'vitest';
import { Pool } from 'pg';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminToken, registerUser } from './fixtures/user.js';
import {
  addTicketCategory,
  createExhibition,
  getSessions,
} from './fixtures/exhibition.js';
import {
  getSessionTickets,
  updateTicketCategoryMaxInventory,
} from './fixtures/inventory.js';
import {
  cancelOrder as cancelOrderByApi,
  createOrder as createOrderByApi,
  getOrder as getOrderByApi,
  listOrders as listOrdersByApi,
} from './fixtures/order.js';
import { random_text } from './lib/random.js';

const schema = 'test_order';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/order.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

type OrderCaseContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticketByName: TicketByName;
  order: Order.OrderWithItems;
  orderDetail: Order.OrderWithItems;
  orderList: Order.OrderListResult;
  ordersByKey: Record<string, Order.OrderWithItems>;
  lastError: unknown;
};

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  adminToken: string;
  userToken: string;
  bobToken: string;
  tokensByName: Record<string, string>;
}

type Cr7ServiceWithPool = {
  pool: Pick<Pool, 'query'>;
};

function rememberError(context: Partial<OrderCaseContext>, error: unknown) {
  Object.assign(context, { lastError: error });
}

function assertLastAPIError(
  context: Partial<OrderCaseContext>,
  options: {
    status: number;
    messageIncludes: string;
    method?: string;
  }
) {
  expect(context.lastError).toBeTruthy();
  return assertAPIError(context.lastError, options);
}

function rememberOrder(
  context: Partial<OrderCaseContext>,
  key: string,
  order: Order.OrderWithItems,
) {
  Object.assign(context, {
    ordersByKey: {
      ...(context.ordersByKey ?? {}),
      [key]: order,
    },
  });
}

function getRememberedOrder(
  context: Partial<OrderCaseContext>,
  key: string,
) {
  const order = context.ordersByKey?.[key];
  expect(order).toBeTruthy();
  return order!;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  Background,
  Scenario,
  context: scenarioContext,
}: FeatureDescriibeCallbackParams<ScenarioContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    const fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer', 'broker']
    );
    Object.assign(scenarioContext, { fixtures });
  });

  AfterAllScenarios(async () => {
    await scenarioContext.fixtures.close();
  });

  async function prepareExhibitionWithTickets(
    context: Partial<OrderCaseContext>,
    names: string[],
    sessionDate: string = '2026-07-01',
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { adminToken } = scenarioContext;

    const exhibition = await createExhibition(apiServer, adminToken, {
      name: `order_test_${random_text(5)}`,
      description: 'Order inventory test exhibition',
      start_date: sessionDate,
      end_date: sessionDate,
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Shanghai',
    });

    const [session] = await getSessions(apiServer, exhibition.id, adminToken);
    const ticketByName: TicketByName = {};

    for (let i = 0; i < names.length; i += 1) {
      const ticketName = names[i];
      const ticket = await addTicketCategory(apiServer, adminToken, exhibition.id, {
        name: ticketName,
        price: 100 + i * 50,
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
        admittance: 1,
      });
      ticketByName[ticketName] = ticket;
    }

    Object.assign(context, {
      exhibition,
      session,
      ticketByName,
    });
  }

  async function setInitialInventory(
    context: Partial<OrderCaseContext>,
    ticketName: string,
    quantity: number,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { adminToken } = scenarioContext;
    const ticket = context.ticketByName?.[ticketName];
    expect(ticket).toBeTruthy();

    await updateTicketCategoryMaxInventory(
      apiServer,
      adminToken,
      context.exhibition!.id,
      ticket!.id,
      quantity,
    );
  }

  async function availableInventoryByTicketName(
    context: Partial<OrderCaseContext>,
    ticketName: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const tickets = await getSessionTickets(
      apiServer,
      scenarioContext.userToken,
      context.exhibition!.id,
      context.session!.id,
    );

    const ticket = context.ticketByName?.[ticketName];
    expect(ticket).toBeTruthy();

    const inventory = tickets.find(item => item.id === ticket!.id);
    expect(inventory).toBeTruthy();

    return inventory!.quantity;
  }

  async function createOrderWithItems(
    context: Partial<OrderCaseContext>,
    items: Array<{ ticketName: string; quantity: number }>,
    token?: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const order = await createOrderByApi(
      apiServer,
      context.exhibition!.id,
      context.session!.id,
      items.map(item => ({
        ticket_category_id: context.ticketByName![item.ticketName].id,
        quantity: item.quantity,
      })),
      token ?? scenarioContext.userToken,
    );

    Object.assign(context, { order });
    return order;
  }

  async function getOrderDetail(
    context: Partial<OrderCaseContext>,
    orderId: string,
    token?: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const orderDetail = await getOrderByApi(
      apiServer,
      orderId,
      token ?? scenarioContext.userToken,
    );

    Object.assign(context, { orderDetail });
    return orderDetail;
  }

  async function listOrders(
    context: Partial<OrderCaseContext>,
    query: {
      status?: Order.OrderStatus;
      page?: number;
      limit?: number;
    } = {},
    token?: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const orderList = await listOrdersByApi(
      apiServer,
      token ?? scenarioContext.userToken,
      query,
    );

    Object.assign(context, { orderList });
    return orderList;
  }

  async function registerScenarioUser(
    alias: string,
    targetKey: 'userToken' | 'bobToken',
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const token = await registerUser(apiServer, `${alias}_${random_text(6)}`);

    Object.assign(scenarioContext, {
      [targetKey]: token,
      tokensByName: {
        ...(scenarioContext.tokensByName ?? {}),
        [alias]: token,
      },
    });

    return token;
  }

  function getUserToken(name: string) {
    const token = scenarioContext.tokensByName?.[name];
    expect(token).toBeTruthy();
    return token!;
  }

  async function expireCurrentOrder(context: Partial<OrderCaseContext>) {
    const { broker } = scenarioContext.fixtures.values;
    const cr7Service = broker.getLocalService('cr7') as unknown as Cr7ServiceWithPool;

    await cr7Service.pool.query(
      `UPDATE ${schema}.exhibit_orders
      SET expires_at = NOW() - INTERVAL '1 minute',
          updated_at = NOW()
      WHERE id = $1`,
      [context.order!.id]
    );
  }

  async function getCurrentOrderStatus(context: Partial<OrderCaseContext>) {
    const { apiServer } = scenarioContext.fixtures.values;
    const order = await getOrderByApi(
      apiServer,
      context.order!.id,
      scenarioContext.userToken,
    );

    return order.status;
  }

  Background(({ Given }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const adminToken = await prepareAdminToken(apiServer, schema);
      Object.assign(scenarioContext, { adminToken });
      expect(scenarioContext.adminToken).toBeTruthy();
    });
    Given('用户 "Alice" 已注册并登录', async () => {
      await registerScenarioUser('Alice', 'userToken');
    });
  });

  Scenario('创建订单成功', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
      expect(context.order!.status).toBe('PENDING_PAYMENT');
    });

    And('场次 "2026-07-01" 的 "成人票" 库存为 1', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(1);
    });
  });

  Scenario('用户预订多个票种', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"、"儿童票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票', '儿童票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    And('场次 "2026-07-01" 的 "儿童票" 库存初始为 3', async () => {
      await setInitialInventory(context, '儿童票', 3);
    });

    When('用户预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票" 和 2 张 "儿童票"', async () => {
      await createOrderWithItems(context, [
        { ticketName: '成人票', quantity: 1 },
        { ticketName: '儿童票', quantity: 2 },
      ]);
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
      expect(context.order!.items).toHaveLength(2);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存为 1', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(1);
    });

    And('场次 "2026-07-01" 的 "儿童票" 库存为 1', async () => {
      const quantity = await availableInventoryByTicketName(context, '儿童票');
      expect(quantity).toBe(1);
    });
  });

  Scenario('用户预订时同一票种重复提交会自动聚合', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 3', async () => {
      await setInitialInventory(context, '成人票', 3);
    });

    When('用户提交两条 "成人票" 订单项，数量分别为 1 和 2', async () => {
      await createOrderWithItems(context, [
        { ticketName: '成人票', quantity: 1 },
        { ticketName: '成人票', quantity: 2 },
      ]);
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
    });

    And('订单中该票种数量为 3', () => {
      expect(context.order).toBeTruthy();
      expect(context.order!.items).toHaveLength(1);
      expect(context.order!.items[0].quantity).toBe(3);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存为 0', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(0);
    });
  });

  Scenario('预订超过库存数量的门票', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 3 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      try {
        await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 3 }]);
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('预订失败，提示库存不足', () => {
      assertLastAPIError(context, {
        status: 409,
        messageIncludes: '库存不足',
      });
    });

    And('场次 "2026-07-01" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('预订已过期场次的门票', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2025-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票'], '2025-07-01');
    });

    And('场次 "2025-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 1 张 "艺术展" 的 "2025-07-01" 场次的 "成人票"', async () => {
      try {
        await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('创建失败，提示场次已过期', () => {
      assertLastAPIError(context, {
        status: 410,
        messageIncludes: '场次已过期',
      });
    });

    And('场次 "2025-07-01" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('取消付款', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('用户取消订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      await cancelOrderByApi(apiServer, context.order!.id, scenarioContext.userToken);
    });

    Then('订单取消成功', () => {
      expect(context.order).toBeTruthy();
    });

    And('场次 "2026-07-01" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('订单过期未付款', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('订单过期未付款', async () => {
      await expireCurrentOrder(context);
    });

    Then('订单变为过期状态不可再付款', async () => {
      const status = await getCurrentOrderStatus(context);
      expect(status).toBe('EXPIRED');
    });

    And('执行订单过期处理任务', async () => {
      const { broker } = scenarioContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    And('场次 "2026-07-01" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('重复取消同一订单不会重复释放库存', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('用户取消订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      await cancelOrderByApi(apiServer, context.order!.id, scenarioContext.userToken);
    });

    And('第一次取消后场次 "2026-07-01" 的 "成人票" 库存应为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });

    And('用户再次取消同一订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      await cancelOrderByApi(apiServer, context.order!.id, scenarioContext.userToken);
    });

    Then('订单取消成功', () => {
      expect(context.order).toBeTruthy();
    });

    And('重复取消后场次 "2026-07-01" 的 "成人票" 库存应为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('过期处理任务重复执行不会重复释放库存', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('订单过期未付款', async () => {
      await expireCurrentOrder(context);
    });

    And('执行订单过期处理任务', async () => {
      const { broker } = scenarioContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    And('再次执行订单过期处理任务', async () => {
      const { broker } = scenarioContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    Then('场次 "2026-07-01" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('用户可以获取自己的订单详情', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      const order = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      rememberOrder(context, 'self', order);
    });

    When('用户查看该订单详情', async () => {
      await getOrderDetail(context, getRememberedOrder(context, 'self').id);
    });

    Then('返回订单详情成功', () => {
      expect(context.orderDetail).toBeTruthy();
      expect(context.orderDetail!.id).toBe(getRememberedOrder(context, 'self').id);
    });

    And('订单包含 1 条订单项', () => {
      expect(context.orderDetail!.items).toHaveLength(1);
    });

    And('订单项为 "艺术展" 的 "2026-07-01" 场次的 "成人票"', () => {
      expect(context.orderDetail!.exhibit_id).toBe(context.exhibition!.id);
      expect(context.orderDetail!.session_id).toBe(context.session!.id);
      expect(context.orderDetail!.items[0].ticket_category_id).toBe(
        context.ticketByName!.成人票.id,
      );
    });
  });

  Scenario('用户不能获取他人的订单详情', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 "Bob" 已注册并登录', async () => {
      await registerScenarioUser('Bob', 'bobToken');
    });

    And('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "2026-07-01" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    And('"Bob" 已成功预订 1 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      const order = await createOrderWithItems(
        context,
        [{ ticketName: '成人票', quantity: 1 }],
        getUserToken('Bob'),
      );
      rememberOrder(context, 'bob', order);
    });

    When('"Alice" 查看 "Bob" 的订单详情', async () => {
      try {
        await getOrderDetail(
          context,
          getRememberedOrder(context, 'bob').id,
          getUserToken('Alice'),
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('查看失败，提示订单不存在或无权限', () => {
      assertLastAPIError(context, {
        status: 404,
        messageIncludes: '订单不存在或无权限',
      });
    });
  });

  Scenario('用户按分页查询订单列表', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户已创建 3 笔订单', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 5);

      for (let i = 0; i < 3; i += 1) {
        await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      }
    });

    When('用户按 page 1、limit 2 查询订单列表', async () => {
      await listOrders(context, { page: 1, limit: 2 });
    });

    Then('返回 2 条订单', () => {
      expect(context.orderList!.orders).toHaveLength(2);
    });

    And('total 为 3', () => {
      expect(context.orderList!.total).toBe(3);
    });

    And('page 为 1', () => {
      expect(context.orderList!.page).toBe(1);
    });

    And('limit 为 2', () => {
      expect(context.orderList!.limit).toBe(2);
    });
  });

  Scenario('用户按状态筛选订单列表', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, context } = s;

    Given('用户有待支付订单、已取消订单和已过期订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;

      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 6);

      const pendingOrder = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      rememberOrder(context, 'pending', pendingOrder);

      const cancelledOrder = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      await cancelOrderByApi(apiServer, cancelledOrder.id, scenarioContext.userToken);
      rememberOrder(context, 'cancelled', cancelledOrder);

      const expiredOrder = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      Object.assign(context, { order: expiredOrder });
      await expireCurrentOrder(context);
      rememberOrder(context, 'expired', expiredOrder);
    });

    When('用户按状态 "待付款" 查询订单列表', async () => {
      await listOrders(context, { status: 'PENDING_PAYMENT' });
    });

    Then('仅返回待支付订单', () => {
      expect(context.orderList!.total).toBe(1);
      expect(context.orderList!.orders).toHaveLength(1);
      expect(context.orderList!.orders[0].status).toBe('PENDING_PAYMENT');
      expect(context.orderList!.orders[0].id).toBe(getRememberedOrder(context, 'pending').id);
    });
  });

  Scenario('用户取消已过期订单失败', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, context } = s;

    Given('用户有一笔已过期订单', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 2);
      const order = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      Object.assign(context, { order });
      await expireCurrentOrder(context);
    });

    When('用户取消该订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;

      try {
        await cancelOrderByApi(apiServer, context.order!.id, scenarioContext.userToken);
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('取消失败，提示订单状态不允许取消', () => {
      assertLastAPIError(context, {
        status: 400,
        messageIncludes: '订单状态不允许取消',
      });
    });
  });

  Scenario('用户创建空订单失败', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户提交空订单项创建订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;

      try {
        await createOrderByApi(
          apiServer,
          context.exhibition!.id,
          context.session!.id,
          [],
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('创建失败，提示参数不合法', () => {
      assertLastAPIError(context, {
        status: 400,
        messageIncludes: '参数不合法',
      });
    });
  });

  Scenario('用户创建数量为 0 的订单项失败', (s: StepTest<Partial<OrderCaseContext>>) => {
    const { Given, When, Then, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "2026-07-01" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 0 张 "艺术展" 的 "2026-07-01" 场次的 "成人票"', async () => {
      try {
        await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 0 }]);
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('创建失败，提示参数不合法', () => {
      assertLastAPIError(context, {
        status: 400,
        messageIncludes: '参数不合法',
      });
    });
  });
});
