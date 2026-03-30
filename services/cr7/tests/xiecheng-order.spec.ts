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
import { getOrder, listOrdersAdmin } from './fixtures/order.js';
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

interface FeatureContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  adminToken: string;
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: TicketByName;
  draftOrder?: DraftOrderContext;
  externalIdSuffix?: string;
}

type DraftOrderContext = {
  serviceName: Xiecheng.XcOrderServiceName;
  body: Xiecheng.XcCreatePreOrderBody;
};

type CallbackContext = {
  callbackResponse?: Xiecheng.XcEncryptedOrderResponse;
  decryptedResponseBody?: Xiecheng.XcCreatePreOrderSuccessBody | null;
};

type SyncRecordContext = {
  records?: Xiecheng.XcOrderSyncRecord[];
  firstRecord?: Xiecheng.XcOrderSyncRecord;
  latestRecord?: Xiecheng.XcOrderSyncRecord;
};

type UserSessionContext = {
  userProfile?: User.Profile;
  userToken?: string;
};

type OrderResultContext = {
  order?: Order.OrderWithItems;
};

type OrderListContext = {
  ordersAdmin?: Order.OrderListResult;
};

type ErrorContext = {
  lastError?: unknown;
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
  options: { tamperBody?: boolean } = {},
) {
  expect(featureContext.draftOrder).toBeTruthy();

  const notification = buildCtripOrderNotification({
    accountId: config.xiecheng.account_id,
    signKey: config.xiecheng.secret,
    aesKey: config.xiecheng.aes_key,
    aesIv: config.xiecheng.aes_iv,
    serviceName: featureContext.draftOrder!.serviceName,
    body: featureContext.draftOrder!.body,
    tamperBody: options.tamperBody,
  });

  try {
    scenarioContext.callbackResponse = await sendCtripOrderCallback(
      featureContext.fixtures.values.apiServer,
      notification,
    );
    scenarioContext.decryptedResponseBody = decryptCtripResponseBody(
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
  scenarioContext.records = await getCtripOrderSyncRecords(
    featureContext.fixtures.values.apiServer,
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

  scenarioContext.userToken = await suUserToken(
    featureContext.fixtures.values.apiServer,
    featureContext.adminToken,
    scenarioContext.latestRecord!.user_id!,
  );

  scenarioContext.userProfile = await getUserProfile(
    featureContext.fixtures.values.apiServer,
    scenarioContext.userToken,
  );

  return scenarioContext.userProfile;
}

async function fetchOrderByRecord(
  featureContext: FeatureContext,
  scenarioContext: SyncRecordContext & UserSessionContext & OrderResultContext,
) {
  if (!scenarioContext.userToken) {
    await fetchUserProfileByRecord(featureContext, scenarioContext);
  }

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
        serviceName: 'CreatePreOrder',
        body: {
          sequenceId: `xc_seq_${Date.now()}`,
          otaOrderId: `xc_order_${Date.now()}`,
          contacts: [{}],
          items: [{
            plu: '',
            useDate: toDateLabel('今天'),
            quantity: 1,
            price: 0,
          }],
        },
      };
    });

    And('携程订单的包含 {string} {int} 张，场次时间为 {string}', (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftOrder!.body.items = [{
        plu: ticket.id,
        useDate: toDateLabel(dateLabel),
        quantity,
        price: ticket.price,
      }];
    });

    And('携程订单的总价为 {string} 的价格', (_ctx, ticketName: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftOrder!.body.items[0].price = ticket.price;
    });

    And('携程订单的购买人姓名是 {string}', (_ctx, name: string) => {
      featureContext.draftOrder!.body.contacts = [{
        ...featureContext.draftOrder!.body.contacts[0],
        name,
      }];
    });

    And('携程订单的购买人手机号是 {string}，国别码为 {string}', (_ctx, phone: string, countryCode: string) => {
      featureContext.draftOrder!.body.contacts = [{
        ...featureContext.draftOrder!.body.contacts[0],
        mobile: phone,
        intlCode: countryCode,
      }];
    });

    And('携程订单信息中的 service name 是 {string}', (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
      featureContext.draftOrder!.serviceName = serviceName;
    });

    And('携程订单中的 PLU id 是 cr7 系统中 {string} 的 ID', (_ctx, ticketName: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftOrder!.body.items[0].plu = ticket.id;
    });

    And('携程订单号是 {string}', (_ctx, otaOrderId: string) => {
      featureContext.draftOrder!.body.otaOrderId = toScenarioScopedId(featureContext, otaOrderId);
    });

    And('携程 sequence id 是 {string}', (_ctx, sequenceId: string) => {
      featureContext.draftOrder!.body.sequenceId = toScenarioScopedId(featureContext, sequenceId);
    });
  });

  Scenario('用户从携程下单购买门票', (s: StepTest<
    CallbackContext & SyncRecordContext & UserSessionContext & OrderResultContext
  >) => {
    const { When, Then, And, context } = s;

    When('用户提交订单', async () => {
      await submitCtripOrder(featureContext, context);
    });

    Then('cr7 系统收到订单创建通知', () => {
      expect(context.callbackResponse).toBeTruthy();
    });

    And('订单信息可以正常解密', async () => {
      expect(context.decryptedResponseBody).toBeTruthy();
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
      expect(context.latestRecord?.request_body).toEqual(featureContext.draftOrder!.body);
    });

    Then('cr7 新整增加了用户 {string} 的账号, 手机号是 {string}，国别码为 {string}', async (_ctx, userName: string, phone: string, countryCode: string) => {
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
      await fetchUserProfileByRecord(featureContext, context);

      expect(context.userProfile?.name).toBe(userName);
      expect(context.userProfile?.phone).toBe(`${countryCode} ${phone}`);
    });

    Then('cr7 创建了一个订单', async () => {
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
      await fetchOrderByRecord(featureContext, context);
      expect(context.order).toBeTruthy();
    });

    And('订单应包含 {string} {int} 张，场次时间为 {string}', (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      const session = getSessionByDate(featureContext.sessions, dateLabel);
      expect(context.order?.items).toHaveLength(1);
      expect(context.order?.items[0].ticket_category_id).toBe(ticket.id);
      expect(context.order?.items[0].quantity).toBe(quantity);
      expect(context.order?.session_id).toBe(session.id);
    });

    And('订单总价应为 {string} 的价格', (_ctx, ticketName: string) => {
      expect(context.order?.total_amount).toBe(getTicketByName(featureContext, ticketName).price);
    });

    And('订单状态为 {string}', (_ctx, statusLabel: string) => {
      expect(statusLabel).toBe('待支付');
      expect(context.order?.status).toBe('PENDING_PAYMENT');
    });

    And('订单的来源是 {string}', (_ctx, sourceLabel: string) => {
      expect(sourceLabel).toBe('携程');
      expect(context.order?.source).toBe('CTRIP');
    });

    And('订单的购买人姓名是 {string}', (_ctx, userName: string) => {
      expect(context.userProfile?.name).toBe(userName);
    });

    Then('cr7 系统按照携程的要求返回订单创建成功的响应', () => {
      assertCtripSuccessResponse(context.callbackResponse!);
      expect(context.decryptedResponseBody?.otaOrderId).toBe(featureContext.draftOrder?.body.otaOrderId);
      expect(context.decryptedResponseBody?.supplierOrderId).toBe(context.latestRecord?.order_id);
    });
  });

  Scenario('携程重复发送同一个订单', (s: StepTest<
    CallbackContext & SyncRecordContext & UserSessionContext & OrderResultContext & OrderListContext
  >) => {
    const { When, Then, And, context } = s;

    When('用户提交订单', async () => {
      await submitCtripOrder(featureContext, context);
    });

    Then('cr7 系统收到订单创建通知', async () => {
      expect(context.callbackResponse).toBeTruthy();
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
    });

    Then('cr7 系统再次收到订单创建通知', async () => {
      expect(context.callbackResponse).toBeTruthy();
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
    });

    And('订单信息可以正常解密', () => {
      expect(context.decryptedResponseBody).toBeTruthy();
      expect(context.latestRecord?.request_body).toEqual(featureContext.draftOrder?.body);
    });

    And('再次收到的订单信息可以正常解密', () => {
      expect(context.decryptedResponseBody).toBeTruthy();
      expect(context.latestRecord?.request_body).toEqual(featureContext.draftOrder?.body);
    });

    Then('cr7 新整增加了用户 {string} 的账号, 手机号是 {string}，国别码为 {string}', async (_ctx, userName: string, phone: string, countryCode: string) => {
      await fetchUserProfileByRecord(featureContext, context);
      expect(context.userProfile?.name).toBe(userName);
      expect(context.userProfile?.phone).toBe(`${countryCode} ${phone}`);
    });

    Then('cr7 创建了一个订单', async () => {
      await fetchOrderByRecord(featureContext, context);
      expect(context.order).toBeTruthy();
      context.firstRecord = context.latestRecord;
    });

    Then('cr7 系统按照携程的要求返回订单创建成功的响应', () => {
      assertCtripSuccessResponse(context.callbackResponse!);
    });

    Then('cr7 系统再次按照携程的要求返回订单创建成功的响应', () => {
      assertCtripSuccessResponse(context.callbackResponse!);
    });

    When('携程重复发送同样的订单创建请求', async () => {
      context.latestRecord = undefined;
      context.callbackResponse = undefined;
      context.decryptedResponseBody = undefined;
    });

    And('携程订单号是 {string}', (_ctx, otaOrderId: string) => {
      featureContext.draftOrder!.body.otaOrderId = toScenarioScopedId(featureContext, otaOrderId);
    });

    And('携程 sequence id 是 {string}', async (_ctx, sequenceId: string) => {
      featureContext.draftOrder!.body.sequenceId = toScenarioScopedId(featureContext, sequenceId);
      await submitCtripOrder(featureContext, context);
    });

    Then('用户 {string} 只有一个账号', async (_ctx, userName: string) => {
      await fetchOrderSyncRecordsByOtaOrderId(featureContext, context, featureContext.draftOrder!.body.otaOrderId);
      expect(context.firstRecord?.user_id).toBe(context.latestRecord?.user_id);
      await fetchUserProfileByRecord(featureContext, context);
      expect(context.userProfile?.name).toBe(userName);
    });

    Then('cr7 系统只有一个订单，订单号是 {string}，订单状态为 {string}', async (_ctx, otaOrderId: string, statusLabel: string) => {
      context.ordersAdmin = await listOrdersAdmin(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
      );

      const matchingOrders = context.ordersAdmin.orders.filter(
        order => order.id === context.latestRecord?.order_id,
      );

      expect(matchingOrders).toHaveLength(1);
      expect(statusLabel).toBe('待支付');
      expect(matchingOrders[0].status).toBe('PENDING_PAYMENT');
      expect(context.latestRecord?.ota_order_id).toBe(toScenarioScopedId(featureContext, otaOrderId));
      expect(matchingOrders[0].id).toBe(context.firstRecord?.order_id);
      expect(matchingOrders[0].id).toBe(context.latestRecord?.order_id);
    });
  });

  Scenario('管理员可以查看单条携程订单同步记录', (s: StepTest<
    CallbackContext & SyncRecordContext
  >) => {
    const { When, Then, And, context } = s;

    When('用户提交订单', async () => {
      await submitCtripOrder(featureContext, context);
    });

    Then('cr7 系统收到订单创建通知', () => {
      expect(context.callbackResponse).toBeTruthy();
    });

    And('订单信息可以正常解密', () => {
      expect(context.decryptedResponseBody).toBeTruthy();
    });

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
      expect(context.firstRecord?.request_body.items[0].plu).toBe(ticket.id);
      expect(context.firstRecord?.request_body.items[0].quantity).toBe(quantity);
      expect(context.firstRecord?.request_body.items[0].useDate).toBe(toDateLabel(dateLabel));
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

    And('同步记录内容包含订单号 {string},序列号 {string}, 同步状态为 {string}', (_ctx, otaOrderId: string, sequenceId: string, statusLabel: string) => {
      expect(context.latestRecord?.ota_order_id).toBe(toScenarioScopedId(featureContext, otaOrderId));
      expect(context.latestRecord?.sequence_id).toBe(toScenarioScopedId(featureContext, sequenceId));
      expect(statusLabel).toBe('重复订单');
      expect(context.latestRecord?.sync_status).toBe('DUPLICATE_ORDER');
    });

    And('最新的同步记录中的 order id 和第一次同步记录中的 order id 保持一致', () => {
      expect(context.latestRecord?.order_id).toBe(context.firstRecord?.order_id);
    });
  });

  Scenario('用户从携程下单购买门票，订单信息被篡改', (s: StepTest<
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
});