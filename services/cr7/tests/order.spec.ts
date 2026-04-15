import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { Exhibition, Order } from '@cr7/types';
import { expect, vi } from 'vitest';
import { isSameDay } from 'date-fns';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { Text2Date, toDateLabel } from './lib/relative-date.js';
import { services_fixtures } from './fixtures/services.js';
import {
  getUserProfile,
  prepareAdminToken,
  wechatMiniLogin,
  wechatBindPhone,
} from './fixtures/user.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
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
  getOrderAdmin as getOrderAdminByApi,
  hideOrder as hideOrderByApi,
  listOrders as listOrdersByApi,
  listOrdersAdmin as listOrdersAdminByApi,
} from './fixtures/order.js';
import { markOrderAsPaidForTest } from './fixtures/payment.js';
import { random_text } from './lib/random.js';
import {
  mockJSONServer,
  mockWechatServer as createMockWechatServer,
  MockServer
} from './lib/server.js';

const schema = 'test_order';
const services = ['api', 'user', 'cr7'];

let mockWechatReqHandler: ReturnType<typeof vi.fn>;
let mockWechatServer: MockServer | undefined;
let mockWechatTokenServer: MockServer | undefined;
let wechatBaseUrlSpy: { mockRestore: () => void } | undefined;
let wechatServiceUrlSpy: { mockRestore: () => void } | undefined;
let currentWechatPhoneBinding = {
  countryCode: '86',
  phone: '12345678901',
};

const feature = await loadFeature('tests/features/order.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

type ExhibitionSetupContext = {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  session: Exhibition.Session;
  ticketByName: TicketByName;
};

type OrderResultContext = {
  order: Order.OrderWithItems;
};

type OrderListContext = {
  orders: Order.OrderListResult
}

type ErrorContext = {
  lastError: unknown;
};

interface DefaultUserContext {
  adminToken: string;
  userToken: string;
  bobToken?: string;
}
interface FeatureContext extends
  DefaultUserContext, ExhibitionSetupContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
}

function getSessionByDate(
  sessions: Exhibition.Session[],
  dateLabel: string
): Exhibition.Session {
  const dateStr = Text2Date(dateLabel);
  const session = sessions.find(s => isSameDay(s.session_date, dateStr));
  expect(session, `Session for ${dateLabel} (${dateStr}) not found`).toBeTruthy();
  return session!;
}

async function availableInventoryByTicketName(
  featureContext: FeatureContext,
  sessionDate: string,
  ticketName: string,
) {
  const { exhibition, sessions, ticketByName, userToken, fixtures } = featureContext;
  const { apiServer } = fixtures.values;
  const session = getSessionByDate(sessions, sessionDate);
  const tickets = await getSessionTickets(apiServer, userToken, exhibition.id, session.id);

  const ticket = ticketByName[ticketName];
  expect(ticket).toBeTruthy();

  const inventory = tickets.find(item => item.id === ticket.id);
  expect(inventory).toBeTruthy();

  return inventory!.quantity;
}

async function createOrderWithItems(
  featureContext: FeatureContext,
  sessionDate: string,
  itemsByName: Array<{ ticketName: string; quantity: number }>,
  token: string = featureContext.userToken,
) {
  const { exhibition, sessions, ticketByName, fixtures } = featureContext;
  const { apiServer } = fixtures.values;

  const items = itemsByName.map(item => ({
    ticket_category_id: ticketByName[item.ticketName].id,
    quantity: item.quantity,
  }));

  const session = getSessionByDate(sessions, sessionDate);
  return createOrderByApi(apiServer, exhibition.id, session.id, items, token);
}

async function registerFeatureUser(
  featureContext: FeatureContext,
  userName: string,
) {
  const { apiServer } = featureContext.fixtures.values;
  const code = `code_${userName}_${random_text(8)}`;
  const response = await wechatMiniLogin(apiServer, code);
  return response.token;
}

function assignUserToken(
  featureContext: FeatureContext,
  userName: string,
  token: string,
) {
  if (userName === 'Alice') {
    featureContext.userToken = token;
    return;
  }

  if (userName === 'Bob') {
    featureContext.bobToken = token;
    return;
  }

  throw new Error(`Unsupported test user: ${userName}`);
}

function getUserTokenByName(
  featureContext: FeatureContext,
  userName: string,
) {
  if (userName === 'Alice') {
    expect(featureContext.userToken).toBeTruthy();
    return featureContext.userToken;
  }

  if (userName === 'Bob') {
    expect(featureContext.bobToken).toBeTruthy();
    return featureContext.bobToken!;
  }

  throw new Error(`Unsupported test user: ${userName}`);
}

async function bindPhoneForUser(
  featureContext: FeatureContext,
  userName: string,
  countryCode: string,
  phone: string,
) {
  const { apiServer } = featureContext.fixtures.values;
  currentWechatPhoneBinding = { countryCode, phone };
  await wechatBindPhone(apiServer, getUserTokenByName(featureContext, userName), `phone_bind_code_${phone}`);
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  Background,
  Scenario,
  ScenarioOutline,
  context: featureContext,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    mockWechatReqHandler = vi.fn(async ({ path, query }: { path: string; query: Record<string, string> }) => {
      if (path === '/sns/jscode2session') {
        const loginKey = query.js_code ?? `code_${random_text(8)}`;
        return {
          openid: `openid_${loginKey}`,
          session_key: `session_key_${loginKey}`,
        };
      }

      if (path === '/wxa/business/getuserphonenumber') {
        return {
          errcode: 0,
          errmsg: 'ok',
          phone_info: {
            phoneNumber: currentWechatPhoneBinding.phone,
            purePhoneNumber: currentWechatPhoneBinding.phone,
            countryCode: currentWechatPhoneBinding.countryCode,
          },
        };
      }

      throw new Error(`Unexpected request to mock wechat server with path: ${path}`);
    });

    mockWechatServer = await createMockWechatServer(mockWechatReqHandler);
    mockWechatTokenServer = await mockJSONServer(async ({ path }) => {
      if (path !== '/access_token') {
        throw new Error(`Unexpected request to mock wechat token server with path: ${path}`);
      }

      return {
        access_token: 'mock_access_token',
        expires_in: 7200,
      };
    });
    const { default: runtimeConfig } = await import('config');
    wechatBaseUrlSpy = vi.spyOn(runtimeConfig.wechat, 'base_url', 'get').mockReturnValue(mockWechatServer.address);
    wechatServiceUrlSpy = vi.spyOn(runtimeConfig.wechat, 'service_url', 'get').mockReturnValue(mockWechatTokenServer.address);

    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    featureContext.fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer', 'broker']
    );
  });

  AfterAllScenarios(async () => {
    await featureContext.fixtures.close();
    wechatServiceUrlSpy?.mockRestore();
    wechatBaseUrlSpy?.mockRestore();
    await mockWechatTokenServer?.close();
    await mockWechatServer?.close();
  });

  Background(({ Given, And }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext.fixtures.values;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
      expect(featureContext.adminToken).toBeTruthy();
    });
    Given('用户 "Alice" 已注册并登录，手机号为 "12345678901", 国别码为 "86"', async () => {
      const token = await registerFeatureUser(featureContext, 'Alice');
      const phone = `13${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`;
      assignUserToken(featureContext, 'Alice', token);
      await bindPhoneForUser(featureContext, 'Alice', '86', phone);
    });

    And('用户 "Bob" 已注册并登录，没有绑定手机号', async () => {
      const token = await registerFeatureUser(featureContext, 'Bob');
      assignUserToken(featureContext, 'Bob', token);
    });

    Given(
      '默认展览活动已创建, 启始时间为 {string}, 结束时间为 {string}',
      async (_ctx, startDate: string, endDate: string) => {
        const { adminToken, fixtures } = featureContext;
        const { apiServer } = fixtures.values;
        featureContext.exhibition = await prepareExhibition(
          apiServer, adminToken,
          {
            start_date: toDateLabel(startDate),
            end_date: toDateLabel(endDate),
          }
        );
        featureContext.sessions = await getSessions(apiServer, featureContext.exhibition.id, adminToken);

      }
    );

    Given('展会添加票种 {string}', async (_ctx, ticketName: string) => {
      const { fixtures, adminToken, exhibition } = featureContext;
      const { apiServer } = fixtures.values;

      const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id);
      featureContext.ticketByName = { [ticketName]: ticket };
    });

    Given('{string} 所有场次库存为 {int}', async (_ctx, ticketName: string, quantity: number) => {
      const { fixtures, adminToken, exhibition, ticketByName } = featureContext;
      const { apiServer } = fixtures.values;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      await updateTicketCategoryMaxInventory(apiServer, adminToken, exhibition.id, ticket.id, quantity);
    });
  });

  Scenario('用户没有绑定手机号时，无法创建订单', (s: StepTest<OrderResultContext & ErrorContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      try {
        await createOrderWithItems(
          featureContext,
          sessionDate,
          [{ ticketName, quantity }],
          getUserTokenByName(featureContext, userName),
        );
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('预订失败，提示请先绑定手机号', () => {
      assertAPIError(context.lastError, {
        status: 409,
        messageIncludes: '请先绑定手机号',
      });
    });

    Given('用户 {string} 已经通过微信绑定手机号，国家码为 {string}，手机号为 {string}', async (_ctx, userName: string, countryCode: string, phone: string) => {
      await bindPhoneForUser(featureContext, userName, countryCode, phone);
    });

    When('用户 {string} 预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      context.order = await createOrderWithItems(
        featureContext,
        sessionDate,
        [{ ticketName, quantity }],
        getUserTokenByName(featureContext, userName),
      );
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
      expect(context.order.status).toBe('PENDING_PAYMENT');
    });

    And('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('创建订单成功', (s: StepTest<OrderResultContext>) => {
    const { When, Then, And, context } = s;

    When('用户 {string} 预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      context.order = order;
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
      expect(context.order.status).toBe('PENDING_PAYMENT');
    });

    And('订单来源为 {string}', (_ctx, source: string) => {
      expect(context.order.source).toBe(source);
    });

    And('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('用户预订多个票种', (s: StepTest<OrderResultContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('该展览已追加票种 {string}', async (_ctx, ticketName: string) => {
      const { exhibition, ticketByName, adminToken, fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      const newTicket = await prepareTicketCategory(
        apiServer,
        adminToken,
        exhibition.id,
        { name: ticketName }
      );

      featureContext.ticketByName = {
          ...ticketByName,
          [ticketName]: newTicket,
      };
    });

    And('{string} 所有场次库存为 {int}', async (_ctx, ticketName: string, quantity: number) => {
        const { exhibition, ticketByName, adminToken } = featureContext;
        const { apiServer } = featureContext.fixtures.values;
        const ticket = ticketByName[ticketName];
        expect(ticket).toBeTruthy();

        await updateTicketCategoryMaxInventory(
          apiServer, adminToken,
          exhibition.id, ticket.id, quantity,
        );
    });

    When('用户 {string} 预订 1 张该展会的 {string} 场次的 "成人票" 和 2 张 "儿童票"', async (_ctx, userName: string, sessionDate: string) => {
      context.order = await createOrderWithItems(
        featureContext,
        sessionDate, [
        { ticketName: '成人票', quantity: 1 },
        { ticketName: '儿童票', quantity: 2 },
      ], getUserTokenByName(featureContext, userName));
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
      expect(context.order.items).toHaveLength(2);
    });

    And('场次 {string} 的 "成人票" 库存为 {int}', async (_ctx, sessionDate: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, '成人票');
      expect(availableQuantity).toBe(quantity);
    });

    And('场次 {string} 的 "儿童票" 库存为 {int}', async (_ctx, sessionDate: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, '儿童票');
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('用户预订时同一票种重复提交会自动聚合', (s: StepTest<OrderResultContext>) => {
    const { When, Then, And, context } = s;

    When('用户 {string} 提交两条 {string} 订单项，数量分别为 1 和 2', async (_ctx, userName: string, ticketName: string) => {
      context.order = await createOrderWithItems(featureContext, '3天后', [
        { ticketName, quantity: 1 },
        { ticketName, quantity: 2 },
      ], getUserTokenByName(featureContext, userName));
    });

    Then('预订成功', () => {
      expect(context.order).toBeTruthy();
    });

    And('订单中该票种数量为 {int}', (_ctx, quantity: number) => {
      const order = context.order;
      expect(order.items).toHaveLength(1);
      expect(order.items[0].quantity).toBe(quantity);
    });

    And('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('预订超过库存数量的门票', (s: StepTest<ErrorContext>) => {
    const { When, Then, And, context } = s;

    When('用户 {string} 预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      try {
        await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('预订失败，提示库存不足', () => {
      assertAPIError(
        context.lastError,
        { status: 409, messageIncludes: '库存不足' }
      );
    });

    And('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('预订已过期场次的门票', (s: StepTest<ErrorContext>) => {
    const { When, Then, And, context } = s;

    When('用户 {string} 预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      try {
        await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('创建失败，提示场次已过期', () => {
      assertAPIError(context.lastError, { status: 410, messageIncludes: '场次已过期' });
    });

    And('场次 "1天前" 的 "成人票" 库存为 3', async () => {
      const { exhibition, sessions, ticketByName, fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      const session = sessions[0];
      const tickets = await getSessionTickets(apiServer, featureContext.userToken, exhibition.id, session.id);
      const target = tickets.find(t => t.id === ticketByName['成人票'].id);
      expect(target?.quantity).toBe(3);
    });
  });

  Scenario('取消付款', (s: StepTest<OrderResultContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      context.order = order;
    });

    When('用户 {string} 取消订单', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;
      expect(context.order).toBeTruthy();
      await cancelOrderByApi(apiServer, context.order.id, getUserTokenByName(featureContext, userName));
    });

    Then('订单取消成功', () => {
      expect(context.order).toBeTruthy();
    });

    And('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('订单过期未付款', (s: StepTest<OrderResultContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      context.order = order;
    });

    When('订单过期未付款', async () => {
      expect(context.order).toBeTruthy();
      await expireOrder(featureContext.fixtures.values.broker, schema, context.order.id);
    });

    Then('订单变为过期状态不可再付款', async () => {
      expect(context.order).toBeTruthy();
      const { userToken, fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      const latestOrder = await getOrderByApi(apiServer, context.order.id, userToken);
      expect(latestOrder.status).toBe('EXPIRED');
    });

    And('执行订单过期处理任务', async () => {
      const { broker } = featureContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    And('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('重复取消同一订单不会重复释放库存', (s: StepTest<OrderResultContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      context.order = order;
    });

    When('用户 {string} 取消订单', async (_ctx, userName: string) => {
      const { fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      expect(context.order).toBeTruthy();
      await cancelOrderByApi(apiServer, context.order.id, getUserTokenByName(featureContext, userName));
    });

    And('第一次取消后场次 {string} 的 {string} 库存应为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });

    And('用户 {string} 再次取消同一订单', async (_ctx, userName: string) => {
      const { fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      expect(context.order).toBeTruthy();
      await cancelOrderByApi(apiServer, context.order.id, getUserTokenByName(featureContext, userName));
    });

    Then('订单取消成功', () => {
      expect(context.order).toBeTruthy();
    });

    And('重复取消后场次 {string} 的 {string} 库存应为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('过期处理任务重复执行不会重复释放库存', (s: StepTest<OrderResultContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      context.order = order;
    });

    When('订单过期未付款', async () => {
      expect(context.order).toBeTruthy();
      await expireOrder(featureContext.fixtures.values.broker, schema, context.order.id);
    });

    And('执行订单过期处理任务', async () => {
      const { broker } = featureContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    And('再次执行订单过期处理任务', async () => {
      const { broker } = featureContext.fixtures.values;
      await broker.call('cr7.order.expire', { batchSize: 100 });
    });

    Then('场次 {string} 的 {string} 库存为 {int}', async (_ctx, sessionDate: string, ticketName: string, quantity: number) => {
      const availableQuantity = await availableInventoryByTicketName(featureContext, sessionDate, ticketName);
      expect(availableQuantity).toBe(quantity);
    });
  });

  Scenario('用户可以获取自己的订单详情', (s: StepTest<OrderResultContext & { orderDetail: Order.OrderWithItems }>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      context.order = order;
    });

    When('用户 {string} 查看该订单详情', async (_ctx, userName: string) => {
      const { fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      expect(context.order).toBeTruthy();
      context.orderDetail = await getOrderByApi(apiServer, context.order.id, getUserTokenByName(featureContext, userName));
    });

    Then('返回订单详情成功', () => {
      expect(context.orderDetail).toBeTruthy();
      expect(context.order).toBeTruthy();
      expect(context.orderDetail!.id).toBe(context.order.id);
    });

    And('订单有场次时间，为 {string}', (_ctx, expectedSessionDate: string) => {
      expect(context.orderDetail).toBeTruthy();
      expect(context.orderDetail.session_date).toBe(toDateLabel(expectedSessionDate));
    });

    And('订单包含 1 条订单项', () => {
      expect(context.orderDetail).toBeTruthy();
      expect(context.orderDetail!.items).toHaveLength(1);
    });

    And('订单项为该展会的 {string} 场次的 {string}', (_ctx, sessionDate: string, ticketName: string) => {
      expect(context.orderDetail).toBeTruthy();
      const orderDetail = context.orderDetail;
      const { exhibition, sessions, ticketByName } = featureContext;
      const session = getSessionByDate(sessions, sessionDate);
      expect(orderDetail.exhibit_id).toBe(exhibition.id);
      expect(orderDetail.session_id).toBe(session.id);
      expect(orderDetail.items[0].ticket_category_id).toBe(ticketByName[ticketName].id);
    });
  });

  Scenario('用户不能获取他人的订单详情', (s: StepTest<OrderResultContext & ErrorContext & { bobToken: string }>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
      context.bobToken = await registerFeatureUser(featureContext, userName);
      assignUserToken(featureContext, userName, context.bobToken);
      const phone = `13${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`;
      await bindPhoneForUser(featureContext, userName, '86', phone);
    });

    And('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, _userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      const token = context.bobToken;
      expect(token).toBeTruthy();
      context.order = await createOrderWithItems(
        featureContext,
        sessionDate,
        [{ ticketName, quantity }],
        token,
      );
    });

    When('用户 {string} 查看 {string} 的订单详情', async (_ctx, viewerName: string, _ownerName: string) => {
      const { userToken, fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      try {
        expect(context.order).toBeTruthy();
        await getOrderByApi(
          apiServer,
          context.order.id,
          viewerName === 'Alice' ? userToken : getUserTokenByName(featureContext, viewerName),
        );
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('查看失败，提示订单不存在或无权限', () => {
      assertAPIError(context.lastError, {
        status: 404,
        messageIncludes: '订单不存在或无权限',
      });
    });
  });

  Scenario('用户按分页查询订单列表', (s: StepTest<OrderListContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已创建 3 笔订单', async (_ctx, userName: string) => {
      for (let i = 0; i < 3; i += 1) {
        await createOrderWithItems(featureContext, '3天后', [{ ticketName: '成人票', quantity: 1 }], getUserTokenByName(featureContext, userName));
      }
    });

    When('用户 {string} 按 page 1、limit 2 查询订单列表', async (_ctx, userName: string) => {
      const { fixtures } = featureContext;
      const { apiServer } = fixtures.values;
      context.orders = await listOrdersByApi(
        apiServer,
        getUserTokenByName(featureContext, userName),
        { page: 1, limit: 2 },
      );
    });

    Then('返回 2 条订单', () => {
      expect(context.orders).toBeTruthy();
      expect(context.orders.orders).toHaveLength(2);
    });

    And('total 为 3', () => {
      expect(context.orders).toBeTruthy();
      expect(context.orders.total).toBe(3);
    });

    And('page 为 1', () => {
      expect(context.orders).toBeTruthy();
      expect(context.orders.page).toBe(1);
    });

    And('limit 为 2', () => {
      expect(context.orders).toBeTruthy();
      expect(context.orders.limit).toBe(2);
    });
  });

  Scenario(
    '用户按状态筛选订单列表',
    (s: StepTest<OrderListContext & { pendingOrder: Order.OrderWithItems;  }>
  ) => {
    const { Given, When, Then, context } = s;

    Given('用户 {string} 有待支付订单、已取消订单和已过期订单', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;
      const userToken = getUserTokenByName(featureContext, userName);

      const pendingOrder = await createOrderWithItems(featureContext, '3天后', [{ ticketName: '成人票', quantity: 1 }], userToken);
      context.pendingOrder = pendingOrder;

      const cancelledOrder = await createOrderWithItems(featureContext, '3天后', [{ ticketName: '成人票', quantity: 1 }], userToken);
      await cancelOrderByApi(apiServer, cancelledOrder.id, userToken);

      const expiredOrder = await createOrderWithItems(featureContext, '3天后', [{ ticketName: '成人票', quantity: 1 }], userToken);
      await expireOrder(featureContext.fixtures.values.broker, schema, expiredOrder.id);
    });

    When('用户 {string} 按状态 {string} 查询订单列表', async (_ctx, userName: string, status: string) => {
      const { apiServer } = featureContext.fixtures.values;
      context.orders = await listOrdersByApi(
        apiServer,
        getUserTokenByName(featureContext, userName),
        { status: status === '待付款' ? 'PENDING_PAYMENT' : undefined },
      );
    });

    Then('仅返回待支付订单', () => {
      expect(context.orders).toBeTruthy();
      expect(context.pendingOrder).toBeTruthy();
      const orderList = context.orders;
      expect(orderList.total).toBe(1);
      expect(orderList.orders).toHaveLength(1);
      expect(orderList.orders[0].status).toBe('PENDING_PAYMENT');
      expect(orderList.orders[0].id).toBe(context.pendingOrder.id);
    });
  });

  Scenario('用户取消已过期订单失败', (s: StepTest<OrderResultContext & ErrorContext>) => {
    const { Given, When, Then, context } = s;

    Given('用户 {string} 有一笔已过期订单', async (_ctx, userName: string) => {
      context.order = await createOrderWithItems(featureContext, '3天后', [{ ticketName: '成人票', quantity: 1 }], getUserTokenByName(featureContext, userName));
      expect(context.order).toBeTruthy();
      await expireOrder(featureContext.fixtures.values.broker, schema, context.order.id);
    });

    When('用户 {string} 取消该订单', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;

      try {
        expect(context.order).toBeTruthy();
        await cancelOrderByApi(apiServer, context.order.id, getUserTokenByName(featureContext, userName));
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('取消失败，提示订单状态不允许取消', () => {
      assertAPIError(context.lastError, {
        status: 400,
        messageIncludes: '订单状态不允许取消',
      });
    });
  });

  Scenario('用户创建空订单失败', (s: StepTest<ErrorContext>) => {
    const { When, Then, context } = s;

    When('用户 {string} 提交空订单项创建订单', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;

      try {
        const { exhibition, sessions } = featureContext;
        const session = getSessionByDate(sessions, '3天后');
        await createOrderByApi(
          apiServer,
          exhibition.id,
          session.id,
          [],
          getUserTokenByName(featureContext, userName),
        );
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('创建失败，提示参数不合法', () => {
      assertAPIError(context.lastError, {
        status: 400,
        messageIncludes: '参数不合法',
      });
    });
  });

  Scenario('用户创建数量为 0 的订单项失败', (s: StepTest<ErrorContext & OrderResultContext>) => {
    const { When, Then, context } = s;

    When('用户 {string} 预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      try {
        await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
      } catch (error) {
        context.lastError = error;
      }
    });

    Then('创建失败，提示参数不合法', () => {
      assertAPIError(context.lastError, {
        status: 400,
        messageIncludes: '参数不合法',
      });
    });
  });

  Scenario('管理员可以查看所有订单列表', (s: StepTest<OrderListContext & OrderResultContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      context.order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
    });

    When('管理员查看订单列表', async () => {
      const { apiServer } = featureContext.fixtures.values;
      context.orders = await listOrdersAdminByApi(apiServer, featureContext.adminToken);
    });

    Then('返回订单列表成功', () => {
      expect(context.orders).toBeTruthy();
      expect(context.orders.orders).toBeInstanceOf(Array);
    });

    And('订单列表包含用户 "Alice" 的订单', () => {
      expect(context.order).toBeTruthy();
      expect(context.orders).toBeTruthy();
      const found = context.orders.orders.find(o => o.id === context.order.id);
      expect(found).toBeTruthy();
    });
  });

  Scenario('管理员可以查看单条订单详情', (s: StepTest<OrderResultContext & { orderDetail: Order.OrderWithItems }>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户 {string} 已成功预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, userName: string, quantity: number, sessionDate: string, ticketName: string) => {
      context.order = await createOrderWithItems(featureContext, sessionDate, [{ ticketName, quantity }], getUserTokenByName(featureContext, userName));
    });

    When('管理员查看该订单详情', async () => {
      const { apiServer } = featureContext.fixtures.values;
      expect(context.order).toBeTruthy();
      context.orderDetail = await getOrderAdminByApi(apiServer, context.order.id, featureContext.adminToken);
    });

    Then('返回订单详情成功', () => {
      expect(context.order).toBeTruthy();
      expect(context.orderDetail).toBeTruthy();
      expect(context.orderDetail.id).toBe(context.order.id);
    });

    And('订单包含用户信息', () => {
      expect(context.order).toBeTruthy();
      expect(context.orderDetail).toBeTruthy();
      expect(context.orderDetail.user_id).toBe(context.order.user_id);
    });

    And('订单包含 1 条订单项', () => {
      expect(context.orderDetail).toBeTruthy();
      expect(context.orderDetail.items).toHaveLength(1);
    });

    And('订单项为该展会的 {string} 场次的 {string}', (_ctx, sessionDate: string, ticketName: string) => {
      expect(context.orderDetail).toBeTruthy();
      const orderDetail = context.orderDetail;
      const { exhibition, sessions, ticketByName } = featureContext;
      const session = getSessionByDate(sessions, sessionDate);
      expect(orderDetail.exhibit_id).toBe(exhibition.id);
      expect(orderDetail.session_id).toBe(session.id);
      expect(orderDetail.items[0].ticket_category_id).toBe(ticketByName[ticketName].id);
    });
  });

  ScenarioOutline(
    '除了未付款且没有过期的订单，其他状态的订单都可以隐藏',
    async (s: StepTest<OrderResultContext>, example) => {
      const { Given, When, Then, And, context } = s;
      const statusText = String(example['订单状态']).trim();

      Given('用户 {string} 有一笔 <订单状态> 的订单', async (_ctx, userName: string) => {
        const { fixtures } = featureContext;
        const { apiServer, broker } = fixtures.values;
        const userToken = getUserTokenByName(featureContext, userName);
        const order = await createOrderWithItems(featureContext, '3天后', [{ ticketName: '成人票', quantity: 1 }], userToken);
        context.order = order;

        if (statusText === '已取消') {
          await cancelOrderByApi(apiServer, order.id, userToken);
        } else if (statusText === '已过期') {
          expect(context.order).toBeTruthy();
          await expireOrder(broker, schema, order.id);
        } else if (statusText === '已完成') {
          const profile = await getUserProfile(apiServer, userToken);
          expect(profile.openid).toBeTruthy();
          await markOrderAsPaidForTest(
            apiServer,
            userToken,
            order,
            profile.openid!,
          );
        }
      });

      When('用户 {string} 隐藏该订单', async (_ctx, userName: string) => {
        const { fixtures } = featureContext;
        const { apiServer } = fixtures.values;
        expect(context.order).toBeTruthy();
        await hideOrderByApi(apiServer, context.order.id, getUserTokenByName(featureContext, userName));
      });

      Then('隐藏成功', () => {
        expect(context.order).toBeTruthy();
      });

      And('订单列表中不再显示该订单', async () => {
        const { fixtures } = featureContext;
        const { apiServer } = fixtures.values;
        const orderList = await listOrdersByApi(apiServer, featureContext.userToken);
        expect(context.order).toBeTruthy();
        const found = orderList.orders.find(o => o.id === context.order.id);
        expect(found).toBeUndefined();
      });

      And('管理员查看订单列表仍然可以看到该订单', async () => {
        const { fixtures } = featureContext;
        const { apiServer } = fixtures.values;
        const adminOrderList = await listOrdersAdminByApi(apiServer, featureContext.adminToken);
        expect(context.order).toBeTruthy();
        const found = adminOrderList.orders.find(o => o.id === context.order.id);
        expect(found).toBeTruthy();
      });
    }
  );
});
