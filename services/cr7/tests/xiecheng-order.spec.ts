import _ from 'lodash';
import config from 'config';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { format } from 'date-fns';
import { expect, vi } from 'vitest';
import type { Exhibition, Order, User, Xiecheng } from '@cr7/types';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { toDateLabel } from './lib/relative-date.js';
import { services_fixtures } from './fixtures/services.js';
import { getSessions, prepareExhibition, prepareTicketCategory } from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { getOrder, getOrderAdmin } from './fixtures/order.js';
import {
  assertCtripFailureResponse,
  assertCtripSuccessResponse,
  buildCtripOrderNotification,
  decryptCtripResponseBody,
  getCtripOrderSyncRecords,
  sendCtripOrderCallback,
} from './fixtures/xiecheng.js';
import { getUserProfile, prepareAdminToken, suUserToken } from './fixtures/user.js';

const schema = 'test_xiecheng_order';
const services = ['api', 'user', 'cr7', 'xiecheng'];

const feature = await loadFeature('tests/features/xiecheng-order.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: TicketByName;
}
interface AdminUserContext {
  adminToken: string;
}

interface DraftOrderContext {
  notification: Xiecheng.XcEncryptedOrderNotification;
  serviceName: Xiecheng.XcOrderServiceName;
  draftOrder: Xiecheng.XcCreatePreOrderBody;
}

interface CallbackContext {
  callbackResponse: Xiecheng.XcEncryptedOrderResponse;
  decryptedResponseBody: Xiecheng.XcCreatePreOrderSuccessBody | null;
}

type SyncRecordContext = {
  records?: Xiecheng.XcOrderSyncRecord[];
  firstRecord?: Xiecheng.XcOrderSyncRecord;
  latestRecord?: Xiecheng.XcOrderSyncRecord;
};

type OrderResultContext = {
  order: Order.OrderWithItems;
  orderUserToken: string;
  orderUserProfile: User.Profile;
};
interface FeatureContext extends
  AdminUserContext,
  ExhibitionContext,
  Partial<DraftOrderContext>,
  Partial<CallbackContext>,
  Partial<OrderResultContext> {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  externalIdSuffix?: string;
}

type UserSessionContext = {
  userProfile?: User.Profile;
  userToken?: string;
};

type OrderListContext = {
  ordersAdmin?: Order.OrderListResult;
};

type ErrorContext = {
  lastError?: unknown;
};

type QueryOrderContext = {
  cr7OrderId?: string;
  draftQueryOrderBody?: Xiecheng.XcQueryOrderBody;
  queryOrderResponse?: Xiecheng.XcEncryptedOrderResponse;
  decryptedQueryResponse?: Xiecheng.XcQueryOrderSuccessBody | null;
};

function getSessionByDate(sessions: Exhibition.Session[], dateLabel: string): Exhibition.Session {
  const sessionDate = toDateLabel(dateLabel);
  const session = sessions.find(item => format(new Date(item.session_date), 'yyyy-MM-dd') === sessionDate);
  expect(session, `Session for ${dateLabel} not found`).toBeTruthy();
  return session!;
}

function getTicketByName(featureContext: FeatureContext, ticketName: string): Exhibition.TicketCategory {
  const ticket = featureContext.ticketByName[ticketName];
  expect(ticket, `Ticket ${ticketName} not found`).toBeTruthy();
  return ticket;
}

function toScenarioScopedId(featureContext: FeatureContext, rawValue: string): string {
  expect(featureContext.externalIdSuffix).toBeTruthy();
  return `${rawValue}__${featureContext.externalIdSuffix}`;
}

async function submitCtripOrder(
  featureContext: FeatureContext,
  scenarioContext: CallbackContext & ErrorContext,
) {
  const { draftOrder, fixtures } = featureContext;
  const apiServer = fixtures.values.apiServer;

  const notification = buildCtripOrderNotification(
    config.xiecheng, 'CreatePreOrder', draftOrder!
  );

  try {
    scenarioContext.callbackResponse = await sendCtripOrderCallback(
      apiServer,
      notification,
    );
    scenarioContext.decryptedResponseBody = decryptCtripResponseBody<
      Xiecheng.XcCreatePreOrderSuccessBody
    >(
      scenarioContext.callbackResponse,
      config.xiecheng.aes_key,
      config.xiecheng.aes_iv,
    );
    scenarioContext.lastError = undefined;
  } catch (error) {
    scenarioContext.lastError = error;
    throw error;
  }
}

async function fetchOrderSyncRecordsByOtaOrderId(
  featureContext: FeatureContext,
  scenarioContext: SyncRecordContext,
  otaOrderId: string,
) {
  const apiServer = featureContext.fixtures.values.apiServer;
  scenarioContext.records = await getCtripOrderSyncRecords(
    apiServer,
    featureContext.adminToken,
    otaOrderId,
  );
  expect(scenarioContext.records.length).toBeGreaterThan(0);
  scenarioContext.latestRecord = scenarioContext.records[0];

  return scenarioContext.records;
}

async function fetchUserProfileByRecord(
  featureContext: FeatureContext,
  scenarioContext: SyncRecordContext & UserSessionContext,
) {
  expect(scenarioContext.latestRecord?.user_id).toBeTruthy();
  const apiServer = featureContext.fixtures.values.apiServer;

  scenarioContext.userToken = await suUserToken(
    apiServer,
    featureContext.adminToken,
    scenarioContext.latestRecord!.user_id!,
  );

  scenarioContext.userProfile = await getUserProfile(
    apiServer,
    scenarioContext.userToken,
  );

  return scenarioContext.userProfile;
}

async function fetchOrderByRecord(
  featureContext: FeatureContext,
  scenarioContext: SyncRecordContext & UserSessionContext & OrderResultContext,
) {
  expect(scenarioContext.latestRecord?.order_id).toBeTruthy();
  scenarioContext.order = await getOrder(
    featureContext.fixtures.values.apiServer,
    scenarioContext.latestRecord!.order_id!,
    scenarioContext.userToken!,
  );

  return scenarioContext.order;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  Background,
  Scenario,
  context: featureContext,
  defineSteps,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    featureContext.fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer', 'broker'],
    );
    featureContext.ticketByName = {};
  });

  AfterAllScenarios(async () => {
    if (featureContext.fixtures) {
      await featureContext.fixtures.close();
    }
    vi.restoreAllMocks();
  });

  Background(({ Given, And }) => {
    Given('系统管理员已经创建并登录', async () => {
      featureContext.adminToken = await prepareAdminToken(
        featureContext.fixtures.values.apiServer,
        schema,
      );
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      featureContext.exhibition = await prepareExhibition(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
        {
          name: `xc_order_${Date.now()}`,
          description: 'xiecheng order integration feature',
          start_date: toDateLabel(startDate),
          end_date: toDateLabel(endDate),
        },
      );
      featureContext.sessions = await getSessions(
        featureContext.fixtures.values.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      featureContext.ticketByName = {};
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (_ctx, ticketName: string, admittance: number) => {
      const ticket = await prepareTicketCategory(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: ticketName,
          admittance,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
        },
      );

      featureContext.ticketByName = {
        ...featureContext.ticketByName,
        [ticketName]: ticket,
      };
    });

    Given('展会添加票种 "单人票", 准入人数为 1, 有效期为场次当天', async () => {
      const ticket = await prepareTicketCategory(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: '单人票',
          admittance: 1,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
        },
      );

      featureContext.ticketByName = {
        ...featureContext.ticketByName,
        单人票: ticket,
      };
    });

    And('{string} 库存为 {int}', async (_ctx, ticketName: string, quantity: number) => {
      const ticket = getTicketByName(featureContext, ticketName);
      await updateTicketCategoryMaxInventory(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        quantity,
      );
    });

    And('"单人票" 库存为 2', async () => {
      const ticket = getTicketByName(featureContext, '单人票');
      await updateTicketCategoryMaxInventory(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        2,
      );
    });

    Given('用户在携程上创建了一个订单', () => {
      featureContext.externalIdSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      featureContext.draftOrder = {
        sequenceId: `xc_seq_${Date.now()}`,
        otaOrderId: `xc_order_${Date.now()}`,
        contacts: [{}],
        items: [{
          PLU: '',
          useStartDate: toDateLabel('今天'),
          useEndDate: toDateLabel('今天'),
          quantity: 1,
          price: 0,
        }]
      };
    });

    And('携程订单的包含 {string} {int} 张，场次时间为 {string}', (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftOrder!.items = [{
        PLU: ticket.id,
        useStartDate: toDateLabel(dateLabel),
        useEndDate: toDateLabel(dateLabel),
        quantity,
        price: ticket.price,
      }];
    });

    And('携程订单的总价为 {string} 的价格', (_ctx, ticketName: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftOrder!.items[0].price = ticket.price;
    });

    And('携程订单的购买人姓名是 {string}', (_ctx, name: string) => {
      featureContext.draftOrder!.contacts = [{
        ...featureContext.draftOrder!.contacts[0],
        name,
      }];
    });

    And('携程订单的购买人手机号是 {string}，国别码为 {string}', (_ctx, phone: string, countryCode: string) => {
      featureContext.draftOrder!.contacts = [{
        ...featureContext.draftOrder!.contacts[0],
        mobile: phone,
        intlCode: countryCode,
      }];
    });

    And('携程订单信息中的 service name 是 {string}', (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
      featureContext.serviceName = serviceName;
    });

    And('携程订单中的 PLU id 是 cr7 系统中 {string} 的 ID', (_ctx, ticketName: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftOrder!.items[0].PLU = ticket.id;
    });

    And('携程订单号是 {string}', (_ctx, otaOrderId: string) => {
      featureContext.draftOrder!.otaOrderId = toScenarioScopedId(featureContext, otaOrderId);
    });

    And('携程 sequence id 是 {string}', (_ctx, sequenceId: string) => {
      featureContext.draftOrder!.sequenceId = toScenarioScopedId(featureContext, sequenceId);
    });
  });

  defineSteps(({ When, Then, And }) => {
    When('用户提交订单', () => {
      const { draftOrder, serviceName } = featureContext;
      featureContext.notification = buildCtripOrderNotification(
        config.xiecheng, serviceName!, draftOrder!
      );
    });

    Then('cr7 系统收到订单创建通知', async () => {
      const { notification, fixtures } = featureContext;
      const apiServer = fixtures.values.apiServer;

      featureContext.callbackResponse = await sendCtripOrderCallback(
        apiServer,
        notification!
      );
    });

    And('订单信息可以正常解密', async () => {
      const { callbackResponse } = featureContext;
      const decryptedResponseBody = decryptCtripResponseBody<
        Xiecheng.XcCreatePreOrderSuccessBody
      >(
        callbackResponse!,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );
      featureContext.decryptedResponseBody = decryptedResponseBody;
    });

    Then('cr7 创建了一个订单', async () => {
      const {
        adminToken,
        decryptedResponseBody,
        fixtures
      } = featureContext;

      const apiServer = fixtures.values.apiServer;
      const orderId = decryptedResponseBody?.supplierOrderId;
      const records = await getCtripOrderSyncRecords(apiServer, adminToken, orderId!);
      expect(records.length).toBeGreaterThan(0);
      const userId = records[0].user_id;
      const userToken = await suUserToken(apiServer, adminToken, userId!);
      featureContext.orderUserToken = userToken;
      featureContext.order = await getOrder(apiServer, orderId!, userToken);
    });

    Then(
      'cr7 新整增加了用户 {string} 的账号, 手机号是 {string}，国别码为 {string}',
      async (_ctx, userName: string, phone: string, countryCode: string) => {
        const { fixtures, orderUserToken } = featureContext;
        const apiServer = fixtures.values.apiServer;
        const userProfile = await getUserProfile(apiServer, orderUserToken!);
        featureContext.orderUserProfile = userProfile;
        expect(userProfile.name).toBe(userName);
        expect(userProfile.phone).toBe(`${countryCode} ${phone}`);
    });

    Then('cr7 系统按照携程的要求返回订单创建成功的响应', () => {
      const { callbackResponse, decryptedResponseBody, draftOrder, order } = featureContext;
      assertCtripSuccessResponse(callbackResponse!);
      expect(decryptedResponseBody?.otaOrderId).toBe(draftOrder?.otaOrderId);
      expect(decryptedResponseBody?.supplierOrderId).toBe(order?.id);
    });
  });

  Scenario('用户从携程下单购买门票', (s: StepTest<
    CallbackContext & SyncRecordContext & UserSessionContext & OrderResultContext
  >) => {
    const { And } = s;

    And('订单应包含 {string} {int} 张，场次时间为 {string}',
      (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
        const { order } = featureContext;
        const ticket = getTicketByName(featureContext, ticketName);
        const session = getSessionByDate(featureContext.sessions, dateLabel);
        expect(order?.items).toHaveLength(1);
        expect(order?.items[0].ticket_category_id).toBe(ticket.id);
        expect(order?.items[0].quantity).toBe(quantity);
        expect(order?.session_id).toBe(session.id);
    });

    And('订单总价应为 {string} 的价格', (_ctx, ticketName: string) => {
      const { order } = featureContext;
      const ticket = getTicketByName(featureContext, ticketName);
      expect(order?.total_amount).toBe(ticket.price);
    });

    And('订单状态为 {string}', (_ctx, statusLabel: string) => {
      expect(statusLabel).toBe('待支付');
      const { order } = featureContext;
      expect(order?.status).toBe('PENDING_PAYMENT');
    });

    And('订单的来源是携程', () => {
      const { order } = featureContext;
      expect(order?.source).toBe('CTRIP');
    });

    And('订单的购买人姓名是 {string}', (_ctx, userName: string) => {
      expect(featureContext.orderUserProfile?.name).toBe(userName);
    });
  });

  Scenario('携程重复发送同一个订单', (s: StepTest<
    DraftOrderContext
    & CallbackContext
    & OrderResultContext
    & OrderListContext
  >) => {
    const { When, Then, And, context } = s;

    When('携程重复发送同样的订单创建请求', async () => {
      context.draftOrder = _.cloneDeep(featureContext.draftOrder!);
    });

    And('携程订单号是 {string}', (_ctx, otaOrderId: string) => {
      context.draftOrder!.otaOrderId = toScenarioScopedId(featureContext, otaOrderId);
    });

    And('携程 sequence id 是 {string}', async (_ctx, sequenceId: string) => {
      context.draftOrder!.sequenceId = toScenarioScopedId(featureContext, sequenceId);
    });

    Then('cr7 系统再次收到订单创建通知', async () => {
      const { fixtures, serviceName } = featureContext;
      const apiServer = fixtures.values.apiServer;
      const { draftOrder } = context;
      const notification = buildCtripOrderNotification(
        config.xiecheng, serviceName!, draftOrder!
      );

      context.callbackResponse = await sendCtripOrderCallback(apiServer, notification);
    });

    And('再次收到的订单信息可以正常解密', async () => {
      const { callbackResponse } = context;
      context.decryptedResponseBody = decryptCtripResponseBody<
        Xiecheng.XcCreatePreOrderSuccessBody
      >(
        callbackResponse,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );
    });

    Then('cr7 系统只有一个订单, cr7 订单号不变, 订单状态不变', async () => {
        const { fixtures, adminToken } = featureContext;
        const apiServer = fixtures.values.apiServer;
        const orderId = context.decryptedResponseBody?.supplierOrderId;
        expect(orderId).toEqual(featureContext.order?.id);
        const order = await getOrderAdmin(apiServer, orderId!, adminToken);
        expect(order.status).toEqual(featureContext.order?.status);
        context.order = order;
    });

    And('订单的用户账号不变', async () => {
      expect(context.order.user_id).toEqual(featureContext.order?.user_id);
    });

    Then('cr7 系统再次按照携程的要求返回订单创建成功的响应', () => {
      const { callbackResponse, decryptedResponseBody } = context;
      assertCtripSuccessResponse(callbackResponse!);
      expect(decryptedResponseBody?.otaOrderId).toEqual(context.draftOrder.otaOrderId);
      expect(decryptedResponseBody?.supplierOrderId).toEqual(context.order?.id);
    });
  });

  Scenario.skip('管理员可以查看单条携程订单同步记录', (s: StepTest<SyncRecordContext>) => {
    const { When, Then, And, context } = s;

    Then('管理员在系统后台可以获取订单号 {string} 的携程同步记录', async (_ctx, otaOrderId: string) => {
      await fetchOrderSyncRecordsByOtaOrderId(
        featureContext,
        context,
        toScenarioScopedId(featureContext, otaOrderId),
      );
      context.firstRecord = context.latestRecord;
    });

    And('同步记录内容包含订单号 {string}，序列号 {string}, 同步状态为 {string}', (_ctx, otaOrderId: string, sequenceId: string, statusLabel: string) => {
      expect(context.firstRecord?.ota_order_id).toBe(toScenarioScopedId(featureContext, otaOrderId));
      expect(context.firstRecord?.sequence_id).toBe(toScenarioScopedId(featureContext, sequenceId));
      expect(statusLabel).toBe('成功');
      expect(context.firstRecord?.sync_status).toBe('SUCCESS');
    });

    And('同步记录中包含手机号 {string}，国别码 {string}', (_ctx, phone: string, countryCode: string) => {
      expect(context.firstRecord?.phone).toBe(phone);
      expect(context.firstRecord?.country_code).toBe(countryCode);
    });

    And('同步记录中包含 {string} {int} 张，场次时间为 {string}', (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      expect(context.firstRecord?.request_body.items).toHaveLength(1);
      expect(context.firstRecord?.request_body.items[0].PLU).toBe(ticket.id);
      expect(context.firstRecord?.request_body.items[0].quantity).toBe(quantity);
      expect(context.firstRecord?.request_body.items[0].useStartDate).toBe(toDateLabel(dateLabel));
      expect(context.firstRecord?.request_body.items[0].useEndDate).toBe(toDateLabel(dateLabel));
    });

    And('同步记录中包含订单总价 {string} 的价格', (_ctx, ticketName: string) => {
      expect(context.firstRecord?.total_amount).toBe(getTicketByName(featureContext, ticketName).price);
    });

    When('携程再次发送订单创建通知', () => {
      context.callbackResponse = undefined;
      context.decryptedResponseBody = undefined;
      context.latestRecord = undefined;
    });

    And('携程订单号是 {string}', (_ctx, otaOrderId: string) => {
      featureContext.draftOrder!.body.otaOrderId = toScenarioScopedId(featureContext, otaOrderId);
    });

    And('携程 sequence id 是 {string}', async (_ctx, sequenceId: string) => {
      featureContext.draftOrder!.body.sequenceId = toScenarioScopedId(featureContext, sequenceId);
      await submitCtripOrder(featureContext, context);
    });

    Then('管理员在系统后台可以获取订单号 {string} 的携程最新同步记录', async (_ctx, otaOrderId: string) => {
      await fetchOrderSyncRecordsByOtaOrderId(
        featureContext,
        context,
        toScenarioScopedId(featureContext, otaOrderId),
      );
    });

    And(
      '同步记录内容包含订单号 {string},序列号 {string}, 同步状态为 {string}',
      (_ctx, otaOrderId: string, sequenceId: string, statusLabel: string) => {
      expect(context.latestRecord?.ota_order_id).toBe(toScenarioScopedId(featureContext, otaOrderId));
      expect(context.latestRecord?.sequence_id).toBe(toScenarioScopedId(featureContext, sequenceId));
      expect(statusLabel).toBe('重复订单');
      expect(context.latestRecord?.sync_status).toBe('DUPLICATE_ORDER');
    });

    And('最新的同步记录中的 order id 和第一次同步记录中的 order id 保持一致', () => {
      expect(context.latestRecord?.order_id).toBe(context.firstRecord?.order_id);
    });
  });

  Scenario.skip('用户从携程下单购买门票，订单信息被篡改', (s: StepTest<
    CallbackContext & ErrorContext & SyncRecordContext
  >) => {
    const { When, Then, And, context } = s;

    When('cr7 系统收到订单创建通知', async () => {
      await submitCtripOrder(featureContext, context, { tamperBody: true });
    });

    Then('cr7 系统无法解密订单信息', async () => {
      assertCtripFailureResponse(context.callbackResponse!, '0001');
      const otaOrderId = featureContext.draftOrder!.body.otaOrderId;

      try {
        await getCtripOrderSyncRecords(
          featureContext.fixtures.values.apiServer,
          featureContext.adminToken,
          otaOrderId,
        );
        throw new Error('Expected order sync record lookup to fail');
      } catch (error) {
        assertAPIError(error, { status: 404, method: 'GET' });
      }
    });

    And('cr7 系统按照携程的要求返回订单创建失败的响应', () => {
      assertCtripFailureResponse(context.callbackResponse!, '0001');
      expect(context.callbackResponse?.body).toBeUndefined();
    });
  });

  Scenario.skip('用户在携程下单后，可以查询订单详情', (s: StepTest<
    CallbackContext & SyncRecordContext & UserSessionContext
    & OrderResultContext & QueryOrderContext
  >) => {
    const { When, Then, And, context } = s;

    And('订单详情包含 {string} {int} 张，场次时间为 {string}', (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      expect(context.decryptedResponseBody?.items[0]).toHaveProperty('PLU', ticket.id);
      expect(context.decryptedResponseBody?.items[0].inventorys[0]).toHaveProperty('quantity', quantity);
      expect(context.decryptedResponseBody?.items[0].inventorys[0]).toHaveProperty('useDate', toDateLabel(dateLabel));
    });

    And('订单 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      expect(context.decryptedResponseBody?.otaOrderId).toBe(toScenarioScopedId(featureContext, otaOrderId));
    });

    Then('cr7 创建了一个订单', async () => {
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
      await fetchUserProfileByRecord(featureContext, context);
      await fetchOrderByRecord(featureContext, context);
      expect(context.order).toBeTruthy();
    });

    And('携程发来了 service name 是 {string} 的订单查询请求', (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
      context.draftQueryOrderBody = {
        sequenceId: `xc_query_seq_${Date.now()}`,
        otaOrderId: featureContext.draftOrder!.body.otaOrderId,
      };
      expect(serviceName).toBe('QueryOrder');
    });

    And('携程订单查询请求中的 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      context.draftQueryOrderBody!.otaOrderId = toScenarioScopedId(featureContext, otaOrderId);
    });

    And('携程订单中的 supplier order id 是 cr7 订单 id', async () => {
      context.draftQueryOrderBody!.supplierOrderId = context.cr7OrderId!;

      const notification = buildCtripOrderNotification(
        config.xiecheng, 'QueryOrder', context.draftQueryOrderBody!
      );

      context.queryOrderResponse = await sendCtripOrderCallback(
        featureContext.fixtures.values.apiServer,
        notification,
      );
      context.decryptedQueryResponse = decryptCtripResponseBody<Xiecheng.XcQueryOrderSuccessBody>(
        context.queryOrderResponse,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );
    });

    Then('cr7 系统按照携程的要求返回订单查询响应', () => {
      assertCtripSuccessResponse(context.queryOrderResponse!);
    });

    And('订单查询响应中包含 supplier order id', () => {
      expect(context.decryptedQueryResponse?.supplierOrderId).toBe(context.cr7OrderId);
    });

    And('订单查询响应中包含 ota order id {string}', (_ctx, otaOrderId: string) => {
      expect(context.decryptedQueryResponse?.otaOrderId).toBe(toScenarioScopedId(featureContext, otaOrderId));
    });

    And('订单查询响应中包含 item id 为票种 id 的订单项，数量为 {int}', (_ctx, quantity: number) => {
      const expectedItemId = featureContext.draftOrder!.body.items[0].PLU;
      expect(context.decryptedQueryResponse?.items).toHaveLength(1);
      expect(context.decryptedQueryResponse?.items[0]).toHaveProperty('itemId', expectedItemId);
      expect(context.decryptedQueryResponse?.items[0]).toHaveProperty('quantity', quantity);
    });

    And('订单查询响应中包含 use start date 和 use end date 分别为 {string} 的开始和结束时间', (_ctx, dateLabel: string) => {
      const expectedDate = toDateLabel(dateLabel);
      expect(context.decryptedQueryResponse?.items[0]).toHaveProperty('useStartDate', expectedDate);
      expect(context.decryptedQueryResponse?.items[0]).toHaveProperty('useEndDate', expectedDate);
    });

    And('订单查询响应中包含订单状态 {string} 值为 {int}', (_ctx, _statusLabel: string, statusValue: number) => {
      expect(context.decryptedQueryResponse?.items[0]).toHaveProperty('orderStatus', statusValue);
    });
  });
});