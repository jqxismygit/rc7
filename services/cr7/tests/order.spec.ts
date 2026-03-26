import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { Exhibition, Order } from '@cr7/types';
import { expect, vi } from 'vitest';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { toDateFromRelativeText } from './lib/relative-date.js';
import { services_fixtures } from './fixtures/services.js';
import { getUserProfile, prepareAdminToken, registerUser } from './fixtures/user.js';
import {
  prepareTicketCategory,
  prepareExhibitionWithNamedTickets,
} from './fixtures/exhibition.js';
import {
  getSessionTickets,
  updateTicketCategoryMaxInventory,
} from './fixtures/inventory.js';
import {
  cancelOrder as cancelOrderByApi,
  createOrder as createOrderByApi,
  expireOrder,
  getOrder as getOrderByApi,
  hideOrder as hideOrderByApi,
  listOrders as listOrdersByApi,
  listOrdersAdmin as listOrdersAdminByApi,
} from './fixtures/order.js';
import { markOrderAsPaidForTest } from './fixtures/payment.js';
import { random_text } from './lib/random.js';

const schema = 'test_order';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/order.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

type ExhibitionSetupContext = {
  exhibition?: Exhibition.Exhibition;
  session?: Exhibition.Session;
  ticketByName?: TicketByName;
};

type OrderResultContext = {
  order?: Order.OrderWithItems;
};

type OrderDetailResultContext = {
  orderDetail?: Order.OrderWithItems;
};

type OrderListResultContext = {
  orderList?: Order.OrderListResult;
};

type RememberedOrdersContext = {
  ordersByKey?: Record<string, Order.OrderWithItems>;
};

type ErrorContext = {
  lastError?: unknown;
};

type PreparedExhibitionSetupContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticketByName: TicketByName;
};

type CreateOrderScenarioContext = ExhibitionSetupContext & OrderResultContext;
type InventoryErrorScenarioContext = ExhibitionSetupContext & ErrorContext;
type OrderLifecycleScenarioContext = ExhibitionSetupContext & OrderResultContext;
type OrderDetailScenarioContext = ExhibitionSetupContext
  & OrderResultContext
  & OrderDetailResultContext
  & RememberedOrdersContext
  & ErrorContext;
type OrderListScenarioContext = ExhibitionSetupContext
  & OrderResultContext
  & OrderListResultContext
  & RememberedOrdersContext;
type HideOrderScenarioContext = ExhibitionSetupContext & OrderResultContext;

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  adminToken: string;
  userToken: string;
  bobToken: string;
  tokensByName: Record<string, string>;
}

function requireExhibitionSetup(
  context: ExhibitionSetupContext,
): PreparedExhibitionSetupContext {
  expect(context.exhibition).toBeTruthy();
  expect(context.session).toBeTruthy();
  expect(context.ticketByName).toBeTruthy();

  return {
    exhibition: context.exhibition!,
    session: context.session!,
    ticketByName: context.ticketByName!,
  };
}

function requireOrder(context: OrderResultContext) {
  expect(context.order).toBeTruthy();
  return context.order!;
}

function requireOrderDetail(context: OrderDetailResultContext) {
  expect(context.orderDetail).toBeTruthy();
  return context.orderDetail!;
}

function requireOrderList(context: OrderListResultContext) {
  expect(context.orderList).toBeTruthy();
  return context.orderList!;
}

function rememberError(context: ErrorContext, error: unknown) {
  Object.assign(context, { lastError: error });
}

function assertLastAPIError(
  context: ErrorContext,
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
  context: RememberedOrdersContext,
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
  context: RememberedOrdersContext,
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
  ScenarioOutline,
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
    context: ExhibitionSetupContext,
    names: string[],
    sessionDate: string = toDateFromRelativeText('3天后'),
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const prepared = await prepareExhibitionWithNamedTickets(
      apiServer,
      scenarioContext.adminToken,
      names,
      {
        exhibitionOverrides: {
          name: `order_test_${random_text(5)}`,
          description: 'Order inventory test exhibition',
          start_date: sessionDate,
          end_date: sessionDate,
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Shanghai',
        },
      },
    );

    Object.assign(context, prepared);
  }

  async function setInitialInventory(
    context: ExhibitionSetupContext,
    ticketName: string,
    quantity: number,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { exhibition, ticketByName } = requireExhibitionSetup(context);
    const ticket = ticketByName[ticketName];
    expect(ticket).toBeTruthy();

    await updateTicketCategoryMaxInventory(
      apiServer,
      scenarioContext.adminToken,
      exhibition.id,
      ticket.id,
      quantity,
    );
  }

  async function appendTicketCategory(
    context: ExhibitionSetupContext,
    ticketName: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { exhibition, ticketByName } = requireExhibitionSetup(context);
    const newTicket = await prepareTicketCategory(
      apiServer,
      scenarioContext.adminToken,
      exhibition.id,
      {
        name: ticketName,
        price: 150,
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
        admittance: 1,
      },
    );

    Object.assign(context, {
      ticketByName: {
        ...ticketByName,
        [ticketName]: newTicket,
      },
    });
  }

  async function availableInventoryByTicketName(
    context: ExhibitionSetupContext,
    ticketName: string,
  ) {
    const { exhibition, session, ticketByName } = requireExhibitionSetup(context);
    const { apiServer } = scenarioContext.fixtures.values;
    const tickets = await getSessionTickets(
      apiServer,
      scenarioContext.userToken,
      exhibition.id,
      session.id,
    );

    const ticket = ticketByName[ticketName];
    expect(ticket).toBeTruthy();

    const inventory = tickets.find(item => item.id === ticket.id);
    expect(inventory).toBeTruthy();

    return inventory!.quantity;
  }

  async function createOrderWithItems(
    context: ExhibitionSetupContext & OrderResultContext,
    items: Array<{ ticketName: string; quantity: number }>,
    token?: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { exhibition, session, ticketByName } = requireExhibitionSetup(context);
    const order = await createOrderByApi(
      apiServer,
      exhibition.id,
      session.id,
      items.map(item => ({
        ticket_category_id: ticketByName[item.ticketName].id,
        quantity: item.quantity,
      })),
      token ?? scenarioContext.userToken,
    );

    Object.assign(context, { order });
    return order;
  }

  async function getOrderDetail(
    context: OrderDetailResultContext,
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
    context: OrderListResultContext,
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

  async function getCurrentOrderStatus(context: OrderResultContext) {
    const { apiServer } = scenarioContext.fixtures.values;
    const order = await getOrderByApi(
      apiServer,
      requireOrder(context).id,
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

  Scenario('创建订单成功', (s: StepTest<CreateOrderScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    Then('预订成功', () => {
      expect(requireOrder(context).status).toBe('PENDING_PAYMENT');
    });

    And('场次 "3天后" 的 "成人票" 库存为 1', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(1);
    });
  });

  Scenario('用户预订多个票种', (s: StepTest<CreateOrderScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('该展览已追加票种 "儿童票"', async () => {
      await appendTicketCategory(context, '儿童票');
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    And('场次 "3天后" 的 "儿童票" 库存初始为 3', async () => {
      await setInitialInventory(context, '儿童票', 3);
    });

    When('用户预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票" 和 2 张 "儿童票"', async () => {
      await createOrderWithItems(context, [
        { ticketName: '成人票', quantity: 1 },
        { ticketName: '儿童票', quantity: 2 },
      ]);
    });

    Then('预订成功', () => {
      expect(requireOrder(context).items).toHaveLength(2);
    });

    And('场次 "3天后" 的 "成人票" 库存为 1', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(1);
    });

    And('场次 "3天后" 的 "儿童票" 库存为 1', async () => {
      const quantity = await availableInventoryByTicketName(context, '儿童票');
      expect(quantity).toBe(1);
    });
  });

  Scenario('用户预订时同一票种重复提交会自动聚合', (s: StepTest<CreateOrderScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 3', async () => {
      await setInitialInventory(context, '成人票', 3);
    });

    When('用户提交两条 "成人票" 订单项，数量分别为 1 和 2', async () => {
      await createOrderWithItems(context, [
        { ticketName: '成人票', quantity: 1 },
        { ticketName: '成人票', quantity: 2 },
      ]);
    });

    Then('预订成功', () => {
      expect(requireOrder(context)).toBeTruthy();
    });

    And('订单中该票种数量为 3', () => {
      const order = requireOrder(context);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(3);
    });

    And('场次 "3天后" 的 "成人票" 库存为 0', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(0);
    });
  });

  Scenario('预订超过库存数量的门票', (s: StepTest<InventoryErrorScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 3 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
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

    And('场次 "3天后" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('预订已过期场次的门票', (s: StepTest<InventoryErrorScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "1天前" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票'], toDateFromRelativeText('1天前'));
    });

    And('场次 "1天前" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 1 张 "艺术展" 的 "1天前" 场次的 "成人票"', async () => {
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

    And('场次 "1天前" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('取消付款', (s: StepTest<OrderLifecycleScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('用户取消订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      await cancelOrderByApi(apiServer, requireOrder(context).id, scenarioContext.userToken);
    });

    Then('订单取消成功', () => {
      expect(requireOrder(context)).toBeTruthy();
    });

    And('场次 "3天后" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('订单过期未付款', (s: StepTest<OrderLifecycleScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('订单过期未付款', async () => {
      await expireOrder(scenarioContext.fixtures.values.broker, schema, requireOrder(context).id);
    });

    Then('订单变为过期状态不可再付款', async () => {
      const status = await getCurrentOrderStatus(context);
      expect(status).toBe('EXPIRED');
    });

    And('执行订单过期处理任务', async () => {
      const { broker } = scenarioContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    And('场次 "3天后" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('重复取消同一订单不会重复释放库存', (s: StepTest<OrderLifecycleScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('用户取消订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      await cancelOrderByApi(apiServer, requireOrder(context).id, scenarioContext.userToken);
    });

    And('第一次取消后场次 "3天后" 的 "成人票" 库存应为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });

    And('用户再次取消同一订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      await cancelOrderByApi(apiServer, requireOrder(context).id, scenarioContext.userToken);
    });

    Then('订单取消成功', () => {
      expect(requireOrder(context)).toBeTruthy();
    });

    And('重复取消后场次 "3天后" 的 "成人票" 库存应为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('过期处理任务重复执行不会重复释放库存', (s: StepTest<OrderLifecycleScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
    });

    When('订单过期未付款', async () => {
      await expireOrder(scenarioContext.fixtures.values.broker, schema, requireOrder(context).id);
    });

    And('执行订单过期处理任务', async () => {
      const { broker } = scenarioContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    And('再次执行订单过期处理任务', async () => {
      const { broker } = scenarioContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    Then('场次 "3天后" 的 "成人票" 库存为 2', async () => {
      const quantity = await availableInventoryByTicketName(context, '成人票');
      expect(quantity).toBe(2);
    });
  });

  Scenario('用户可以获取自己的订单详情', (s: StepTest<OrderDetailScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    Given('用户已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      const order = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      rememberOrder(context, 'self', order);
    });

    When('用户查看该订单详情', async () => {
      await getOrderDetail(context, getRememberedOrder(context, 'self').id);
    });

    Then('返回订单详情成功', () => {
      expect(requireOrderDetail(context).id).toBe(getRememberedOrder(context, 'self').id);
    });

    And('订单包含 1 条订单项', () => {
      expect(requireOrderDetail(context).items).toHaveLength(1);
    });

    And('订单项为 "艺术展" 的 "3天后" 场次的 "成人票"', () => {
      const orderDetail = requireOrderDetail(context);
      const { exhibition, session, ticketByName } = requireExhibitionSetup(context);
      expect(orderDetail.exhibit_id).toBe(exhibition.id);
      expect(orderDetail.session_id).toBe(session.id);
      expect(orderDetail.items[0].ticket_category_id).toBe(ticketByName['成人票'].id);
    });
  });

  Scenario('用户不能获取他人的订单详情', (s: StepTest<OrderDetailScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 "Bob" 已注册并登录', async () => {
      await registerScenarioUser('Bob', 'bobToken');
    });

    And('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 2', async () => {
      await setInitialInventory(context, '成人票', 2);
    });

    And('"Bob" 已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
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

  Scenario('用户按分页查询订单列表', (s: StepTest<OrderListScenarioContext>) => {
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
      expect(requireOrderList(context).orders).toHaveLength(2);
    });

    And('total 为 3', () => {
      expect(requireOrderList(context).total).toBe(3);
    });

    And('page 为 1', () => {
      expect(requireOrderList(context).page).toBe(1);
    });

    And('limit 为 2', () => {
      expect(requireOrderList(context).limit).toBe(2);
    });
  });

  Scenario('用户按状态筛选订单列表', (s: StepTest<OrderListScenarioContext>) => {
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
      await expireOrder(scenarioContext.fixtures.values.broker, schema, requireOrder(context).id);
      rememberOrder(context, 'expired', expiredOrder);
    });

    When('用户按状态 "待付款" 查询订单列表', async () => {
      await listOrders(context, { status: 'PENDING_PAYMENT' });
    });

    Then('仅返回待支付订单', () => {
      const orderList = requireOrderList(context);
      expect(orderList.total).toBe(1);
      expect(orderList.orders).toHaveLength(1);
      expect(orderList.orders[0].status).toBe('PENDING_PAYMENT');
      expect(orderList.orders[0].id).toBe(getRememberedOrder(context, 'pending').id);
    });
  });

  Scenario('用户取消已过期订单失败', (s: StepTest<OrderLifecycleScenarioContext & ErrorContext>) => {
    const { Given, When, Then, context } = s;

    Given('用户有一笔已过期订单', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 2);
      const order = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
      Object.assign(context, { order });
      await expireOrder(scenarioContext.fixtures.values.broker, schema, requireOrder(context).id);
    });

    When('用户取消该订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;

      try {
        await cancelOrderByApi(apiServer, requireOrder(context).id, scenarioContext.userToken);
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

  Scenario('用户创建空订单失败', (s: StepTest<InventoryErrorScenarioContext>) => {
    const { Given, When, Then, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户提交空订单项创建订单', async () => {
      const { apiServer } = scenarioContext.fixtures.values;

      try {
        const { exhibition, session } = requireExhibitionSetup(context);
        await createOrderByApi(
          apiServer,
          exhibition.id,
          session.id,
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

  Scenario('用户创建数量为 0 的订单项失败', (s: StepTest<InventoryErrorScenarioContext & OrderResultContext>) => {
    const { Given, When, Then, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
      await setInitialInventory(context, '成人票', 2);
    });

    When('用户预订 0 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
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

  Scenario('管理员可以查看所有订单列表', (s: StepTest<OrderListScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('展览活动 "艺术展" 已创建，包含场次 "3天后" 和票种 "成人票"', async () => {
      await prepareExhibitionWithTickets(context, ['成人票']);
    });

    And('场次 "3天后" 的 "成人票" 库存初始为 10', async () => {
      await setInitialInventory(context, '成人票', 10);
    });

    And('用户 "Bob" 已成功预订 1 张 "艺术展" 的 "3天后" 场次的 "成人票"', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const bobToken = await registerUser(apiServer, `Bob_${random_text(6)}`);
      Object.assign(scenarioContext, {
        bobToken,
        tokensByName: { ...(scenarioContext.tokensByName ?? {}), Bob: bobToken },
      });
      const order = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }], bobToken);
      rememberOrder(context, 'bob', order);
    });

    When('管理员查看订单列表', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const orderList = await listOrdersAdminByApi(apiServer, scenarioContext.adminToken);
      Object.assign(context, { orderList });
    });

    Then('返回订单列表成功', () => {
      expect(requireOrderList(context).orders).toBeInstanceOf(Array);
    });

    And('订单列表包含用户 "Bob" 的订单', () => {
      const bobOrder = getRememberedOrder(context, 'bob');
      const found = requireOrderList(context).orders.find(o => o.id === bobOrder.id);
      expect(found).toBeTruthy();
    });
  });

  ScenarioOutline(
    '除了未付款且没有过期的订单，其他状态的订单都可以隐藏',
    async (s: StepTest<HideOrderScenarioContext>, example) => {
      const { Given, When, Then, And, context } = s;
      const statusText = String(example['订单状态']).trim();

      Given('用户有一笔 <订单状态> 的订单', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        await prepareExhibitionWithTickets(context, ['成人票']);
        await setInitialInventory(context, '成人票', 2);
        const order = await createOrderWithItems(context, [{ ticketName: '成人票', quantity: 1 }]);
        Object.assign(context, { order });

        if (statusText === '已取消') {
          await cancelOrderByApi(apiServer, order.id, scenarioContext.userToken);
        } else if (statusText === '已过期') {
          await expireOrder(scenarioContext.fixtures.values.broker, schema, requireOrder(context).id);
        } else if (statusText === '已完成') {
          const profile = await getUserProfile(apiServer, scenarioContext.userToken);
          expect(profile.openid).toBeTruthy();
          await markOrderAsPaidForTest(
            apiServer,
            scenarioContext.userToken,
            order,
            profile.openid!,
          );
        }
      });

      When('用户隐藏该订单', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        await hideOrderByApi(apiServer, requireOrder(context).id, scenarioContext.userToken);
      });

      Then('隐藏成功', () => {
        expect(requireOrder(context)).toBeTruthy();
      });

      And('订单列表中不再显示该订单', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const orderList = await listOrdersByApi(apiServer, scenarioContext.userToken);
        const found = orderList.orders.find(o => o.id === requireOrder(context).id);
        expect(found).toBeUndefined();
      });

      And('管理员查看订单列表仍然可以看到该订单', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const adminOrderList = await listOrdersAdminByApi(apiServer, scenarioContext.adminToken);
        const found = adminOrderList.orders.find(o => o.id === requireOrder(context).id);
        expect(found).toBeTruthy();
      });
    }
  );
});
