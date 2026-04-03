import { Server } from 'node:http';
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
import { ServiceBroker } from 'moleculer';
import type { Exhibition, Order, Redeem, User, Xiecheng } from '@cr7/types';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { toDateLabel } from './lib/relative-date.js';
import {
  prepareServices, prepareAPIServer
} from './fixtures/services.js';
import { MockServer, mockJSONServer } from './lib/server.js';
import { getOrderRedemption, redeemCode } from './fixtures/redeem.js';
import { getSessions, prepareExhibition, prepareTicketCategory } from './fixtures/exhibition.js';
import { getSessionTickets, updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { getOrder, getOrderAdmin } from './fixtures/order.js';
import {
  assertCtripFailureResponse,
  assertCtripSuccessResponse,
  buildCtripOrderNotification,
  decryptCtripResponseBody,
  getCtripOrderSyncRecords,
  listCtripOrderSyncRecords,
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

interface SyncRecordContext {
  records: Xiecheng.XcOrderSyncRecord[];
};

interface OrderResultContext {
  order: Order.OrderWithItems;
  orderUserToken: string;
  orderUserProfile: User.Profile;
};

interface OrderQueryContext {
  serviceName: Xiecheng.XcOrderServiceName
  draftQueryOrderBody: Xiecheng.XcQueryOrderBody;
  queryOrderResponse: Xiecheng.XcEncryptedOrderResponse;
  decryptedQueryResponse: Xiecheng.XcQueryOrderSuccessBody;
}

interface OrderPayContext {
  serviceName: Xiecheng.XcOrderServiceName;
  draftPayOrderBody: Xiecheng.XcPayPreOrderBody;
  payOrderResponse: Xiecheng.XcEncryptedOrderResponse;
  decryptedPayResponse: Xiecheng.XcPayPreOrderSuccessBody | null;
  redemption: Redeem.RedemptionCodeWithOrder;
  paidOrder: Order.OrderWithItems;
}

interface FeatureContext extends
  AdminUserContext,
  ExhibitionContext,
  Partial<DraftOrderContext>,
  Partial<CallbackContext>,
  Partial<OrderResultContext>,
  Partial<OrderQueryContext>,
  Partial<OrderPayContext> {
    broker: ServiceBroker;
    apiServer: Server;
}

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


describeFeature(feature, ({
  AfterEachScenario,
  AfterAllScenarios,
  BeforeAllScenarios,
  Background,
  Scenario,
  context: featureContext,
  defineSteps,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    await bootstrap();
    const broker = await prepareServices(services);
    await broker.start();
    featureContext.broker = broker;
    featureContext.apiServer = await prepareAPIServer(broker);
  });

  AfterAllScenarios(async () => {
    const { broker } = featureContext;
    if (broker) {
      await broker.stop();
    }
    vi.restoreAllMocks();
  });

  AfterEachScenario(async () => {
    await dropSchema({ schema });
  });

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });

    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      featureContext.exhibition = await prepareExhibition(
        featureContext.apiServer,
        featureContext.adminToken,
        {
          name: `xc_order_${Date.now()}`,
          description: 'xiecheng order integration feature',
          start_date: toDateLabel(startDate),
          end_date: toDateLabel(endDate),
        },
      );
      featureContext.sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      featureContext.ticketByName = {};
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (_ctx, ticketName: string, admittance: number) => {
      const ticket = await prepareTicketCategory(
        featureContext.apiServer,
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
        featureContext.apiServer,
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
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        quantity,
      );
    });

    And('"单人票" 库存为 2', async () => {
      const ticket = getTicketByName(featureContext, '单人票');
      await updateTicketCategoryMaxInventory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        2,
      );
    });

    Given('用户在携程上创建了一个订单', () => {
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
      featureContext.draftOrder!.otaOrderId = otaOrderId;
    });

    And('携程 sequence id 是 {string}', (_ctx, sequenceId: string) => {
      featureContext.draftOrder!.sequenceId = sequenceId;
    });

  });

  defineSteps(({ Given, When, Then, And }) => {
    When('用户提交订单', () => {
      const { draftOrder, serviceName } = featureContext;
      featureContext.notification = buildCtripOrderNotification(
        config.xiecheng, serviceName!, draftOrder!
      );
    });

    Then('cr7 系统收到订单创建通知', async () => {
      const { notification, apiServer } = featureContext;

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
        apiServer
      } = featureContext;

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
        const { orderUserToken, apiServer } = featureContext;
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

    Given(
      '携程 service name 是 {string} 的订单查询请求',
      (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
      featureContext.draftQueryOrderBody = {
        sequenceId: `xc_query_seq_${Date.now()}`,
        otaOrderId: featureContext.draftOrder!.otaOrderId,
      };
      featureContext.serviceName = serviceName;
    });

    And('携程订单查询请求中的 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      featureContext.draftQueryOrderBody!.otaOrderId = otaOrderId;
    });

    And('携程订单查询请求中的 supplier order id 是 cr7 订单 id', async () => {
      const { order } = featureContext;
      featureContext.draftQueryOrderBody!.supplierOrderId = order?.id;
    });

    When('携程发送订单查询请求', async () => {
      const { serviceName, draftQueryOrderBody } = featureContext;
      const notification = buildCtripOrderNotification(
        config.xiecheng, serviceName!, draftQueryOrderBody!
      );

      featureContext.queryOrderResponse = await sendCtripOrderCallback(
        featureContext.apiServer,
        notification,
      );
      featureContext.decryptedQueryResponse = decryptCtripResponseBody<Xiecheng.XcQueryOrderSuccessBody>(
        featureContext.queryOrderResponse,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );
    });

    Then('cr7 系统按照携程的要求返回订单查询响应', () => {
      const { queryOrderResponse } = featureContext;
      assertCtripSuccessResponse(queryOrderResponse!);
    });

    And('订单查询响应中包含 supplier order id', () => {
      const { order } = featureContext;
      expect(featureContext.decryptedQueryResponse?.supplierOrderId).toBe(order?.id);
    });

    And('订单查询响应中包含 ota order id {string}', (_ctx, otaOrderId: string) => {
      expect(featureContext.decryptedQueryResponse?.otaOrderId).toBe(otaOrderId);
    });

    And('订单查询响应中包含 1 个 的订单项，其数量为 {int}', (_ctx, quantity: number) => {
      expect(featureContext.decryptedQueryResponse?.items).toHaveLength(1);
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('quantity', quantity);
    });

    And('订单查询响应中订单项的 item id 因为订单还没有支付，所以为 {int}', (_ctx, itemId: number) => {
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('itemId', itemId);
    });

    And('订单查询响应中订单项的 item id 因为订单已经支付，所以为 {string}', (_ctx, itemId: string) => {
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('itemId', itemId);
    });

    And('订单查询响应中订单项的 item id 因为订单已经退款，所以为 {int}', (_ctx, itemId: number) => {
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('itemId', itemId);
    });

    Then('管理员查看场次 {string} 的 {string} 库存应该是 {int}', async (_ctx, dateLabel: string, ticketName: string, quantity: number) => {
      const { apiServer, sessions, adminToken, exhibition } = featureContext;
      const session = getSessionByDate(sessions, dateLabel);
      const ticket = getTicketByName(featureContext, ticketName);
      const inventories = await getSessionTickets(apiServer, adminToken, exhibition.id, session.id);
      const inventory = inventories.find(item => item.id === ticket.id);
      expect(inventory, `Inventory for ticket ${ticketName} in session ${dateLabel} not found`).toBeTruthy();
      expect(inventory!.quantity).toBe(quantity);
    });

    And('订单查询响应中订单项的实际使用份数是 {int}', (_ctx, useQuantity: number) => {
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('useQuantity', useQuantity);
    });

    Given(
      '携程 service name 是 {string} 的订单支付请求',
      (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
        const { order, draftOrder } = featureContext;
        featureContext.serviceName = serviceName;
        featureContext.draftPayOrderBody = {
          orderLastConfirmTime: toDateLabel('今天'),
          supplierOrderId: order!.id,
          otaOrderId: draftOrder!.otaOrderId,
          sequenceId: `xc_pay_seq_${Date.now()}`,
          confirmType: 2,
          items: [{
            itemId: '0',
            PLU: draftOrder!.items[0].PLU,
          }],
        };
    });

    And('携程订单支付请求中的 supplier order id 是用户创建的订单 id', () => {
      featureContext.draftPayOrderBody!.supplierOrderId = featureContext.order!.id;
    });

    And('携程订单支付请求中的 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      featureContext.draftPayOrderBody!.otaOrderId = otaOrderId;
    });

    And('携程订单支付请求中的 sequence id 是 {string}', (_ctx, sequenceId: string) => {
      featureContext.draftPayOrderBody!.sequenceId = sequenceId;
    });

    And('携程订单支付请求中的订单项 id 是 {string}', (_ctx, itemId: string) => {
      featureContext.draftPayOrderBody!.items[0].itemId = itemId;
    });

    And('携程订单支付请求中的 items.0.PLU 是 {string} 的 id', (_ctx, ticketName: string) => {
      const ticket = getTicketByName(featureContext, ticketName);
      featureContext.draftPayOrderBody!.items[0].PLU = ticket.id;
    });

    When('携程发送订单支付请求', async () => {
      const { serviceName, draftPayOrderBody } = featureContext;
      const notification = buildCtripOrderNotification(
        config.xiecheng,
        serviceName!,
        draftPayOrderBody!
      );

      featureContext.payOrderResponse = await sendCtripOrderCallback(
        featureContext.apiServer,
        notification,
      );
    });

    Then('cr7 系统按照携程的要求返回订单支付响应', async () => {
      const { adminToken, apiServer, order, orderUserToken } = featureContext;
      const { payOrderResponse } = featureContext;
      assertCtripSuccessResponse(payOrderResponse!);
      featureContext.decryptedPayResponse = decryptCtripResponseBody<
        Xiecheng.XcPayPreOrderSuccessBody
      >(
        payOrderResponse!,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );

      featureContext.paidOrder = await getOrderAdmin(
        apiServer,
        order!.id,
        adminToken,
      );
      featureContext.redemption = await getOrderRedemption(
        apiServer,
        order!.id,
        orderUserToken!,
      );
    });

    And('订单支付响应中订单状态为已支付，值为 {int}', (_ctx, statusValue: number) => {
      const { decryptedPayResponse, paidOrder } = featureContext;
      expect(paidOrder!.status).toBe('PAID');
      expect(decryptedPayResponse!.items[0]).toHaveProperty('orderStatus', statusValue);
    });
  });

  Scenario('用户从携程下单购买门票', (s: StepTest<OrderResultContext>) => {
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
  >) => {
    const { When, Then, And, context } = s;

    When('携程重复发送同样的订单创建请求', async () => {
      context.draftOrder = _.cloneDeep(featureContext.draftOrder!);
    });

    And('携程订单号是 {string}', (_ctx, otaOrderId: string) => {
      context.draftOrder!.otaOrderId = otaOrderId;
    });

    And('携程 sequence id 是 {string}', async (_ctx, sequenceId: string) => {
      context.draftOrder!.sequenceId = sequenceId;
    });

    Then('cr7 系统再次收到订单创建通知', async () => {
      const { serviceName, apiServer } = featureContext;
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
        const { adminToken, apiServer } = featureContext;
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

  Scenario('管理员可以查看单条携程订单同步记录', (s: StepTest<SyncRecordContext>) => {
    const { When, Then, And, context } = s;

    Then(
      '管理员在系统后台可以获取订单号 {string} 的携程同步记录',
      async (_ctx, otaOrderId: string) => {
      const { adminToken, apiServer, order } = featureContext;
      const orderId = order?.id;
      const records = await getCtripOrderSyncRecords(apiServer, adminToken, orderId!);
      expect(records.length).toEqual(1);
      expect(records[0].ota_order_id).toBe(otaOrderId);

      const listResult = await listCtripOrderSyncRecords(apiServer, adminToken, {
        limit: 10,
        offset: 0,
        ota_order_id: otaOrderId,
      });
      expect(listResult.total).toBe(1);
      expect(listResult.data).toHaveLength(1);
      expect(listResult.data[0].order_id).toBe(orderId);
      context.records = records;
    });

    And(
      '同步记录内容包含订单号 {string}，序列号 {string}, 同步状态是成功',
      (_ctx, otaOrderId: string, sequenceId: string) => {
        const { records: [latestRecord] } = context;
      expect(latestRecord.ota_order_id).toBe(otaOrderId);
      expect(latestRecord.sequence_id).toBe(sequenceId);
      expect(latestRecord.sync_status).toBe('SUCCESS');
    });

    And(
      '同步记录中包含手机号 {string}，国别码 {string}',
      (_ctx, phone: string, countryCode: string) => {
      const { records: [latestRecord] } = context;
      expect(latestRecord.phone).toBe(phone);
      expect(latestRecord.country_code).toBe(countryCode);
    });

    And(
      '同步记录中包含 {string} {int} 张，场次时间为 {string}',
      (_ctx, ticketName: string, quantity: number, dateLabel: string) => {
      const { records: [latestRecord] } = context;
      const requestBody = latestRecord.request_body as Xiecheng.XcCreatePreOrderBody;
      const ticket = getTicketByName(featureContext, ticketName);
      expect(requestBody.items).toHaveLength(1);
      expect(requestBody.items[0].PLU).toBe(ticket.id);
      expect(requestBody.items[0].quantity).toBe(quantity);
      expect(requestBody.items[0].useStartDate).toBe(toDateLabel(dateLabel));
      expect(requestBody.items[0].useEndDate).toBe(toDateLabel(dateLabel));
    });

    And('同步记录中包含订单总价 {string} 的价格', (_ctx, ticketName: string) => {
      const { records: [latestRecord] } = context;
      const ticket = getTicketByName(featureContext, ticketName);
      expect(latestRecord?.total_amount).toBe(ticket.price);
    });

    When(
      '携程再次发送订单创建通知, 订单号是 {string}, sequence id 是 {string}',
      async (_ctx, otaOrderId: string, sequenceId: string) => {
      const { apiServer } = featureContext;
      const draftOrder = _.cloneDeep(featureContext.draftOrder!);
      draftOrder.otaOrderId = otaOrderId;
      draftOrder.sequenceId = sequenceId;
      const notification = buildCtripOrderNotification(
        config.xiecheng, 'CreatePreOrder', draftOrder
      );
      await expect(sendCtripOrderCallback(apiServer, notification!)).resolves.toBeTruthy();
    });

    Then('管理员在系统后台可以获取订单号 {string} 的携程最新同步记录', async (_ctx, otaOrderId: string) => {
      const { order, apiServer, adminToken } = featureContext;
      const orderId = order?.id;
      const records = await getCtripOrderSyncRecords(apiServer, adminToken, orderId!);
      expect(records.length).toEqual(2);
      const latestRecord = records[1];
      expect(latestRecord.ota_order_id).toEqual(otaOrderId);
      context.records = records;
    });

    And(
      '同步记录内容包含订单号 {string},序列号 {string}, 同步状态为重复订单',
      (_ctx, otaOrderId: string, sequenceId: string) => {
        expect(context.records.length).toEqual(2);
        const { records: [latestRecord] } = context;
        expect(latestRecord.ota_order_id).toEqual(otaOrderId);
        expect(latestRecord.sequence_id).toEqual(sequenceId);
        expect(latestRecord.sync_status).toBe('DUPLICATE_ORDER');
    });

    And('最新的同步记录中的 order id 和第一次同步记录中的 order id 保持一致', () => {
      const { records: [latestRecord, firstRecord] } = context;
      expect(latestRecord.order_id).toBe(firstRecord.order_id);
    });
  });

  Scenario('用户从携程下单购买门票，订单信息被篡改', (
    s: StepTest<CallbackContext & SyncRecordContext>) => {
    const { When, Then, And, context } = s;

    When('cr7 系统收到订单创建通知', async () => {
      const { draftOrder, serviceName, apiServer } = featureContext;
      const notification = buildCtripOrderNotification(
        config.xiecheng, serviceName!, draftOrder!
      );
      notification.body = 'invalid body';
      context.callbackResponse = await sendCtripOrderCallback(
        apiServer,
        notification
      );
    });

    Then('cr7 系统无法解密订单信息', async () => {
      assertCtripFailureResponse(context.callbackResponse!, '0002');
      const { apiServer, adminToken, draftOrder } = featureContext;
      const otaOrderId = draftOrder!.otaOrderId;

      const listResult = await listCtripOrderSyncRecords(apiServer, adminToken, {
        limit: 10,
        offset: 0,
        ota_order_id: otaOrderId,
      });
      expect(listResult.total).toBe(0);
      expect(listResult.data).toEqual([]);
    });

    And('cr7 系统按照携程的要求返回订单创建失败的响应', () => {
      assertCtripFailureResponse(context.callbackResponse!, '0002');
      expect(context.callbackResponse?.body).toBeUndefined();
    });
  });

  Scenario('用户在携程下单后，可以查询订单详情', (s: StepTest<void>) => {
    const { And } = s;

    And('订单查询响应中包含 use start date 和 use end date 分别为 {string} 的开始和结束时间', (_ctx, dateLabel: string) => {
      const expectedDate = toDateLabel(dateLabel);
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('useStartDate', expectedDate);
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('useEndDate', expectedDate);
    });

    And('订单查询响应中包含订单状态 "待付款" 值为 {int}', (_ctx, statusValue: number) => {
      expect(featureContext.decryptedQueryResponse?.items[0]).toHaveProperty('orderStatus', statusValue);
    });
  });

  Scenario('用户在携程下单后，取消了订单', (s: StepTest<{
    serviceName: Xiecheng.XcOrderServiceName;
    draftCancelOrderBody: Xiecheng.XcCancelPreOrderBody;
    cancelOrderResponse: Xiecheng.XcEncryptedOrderResponse;
    decryptedCancelResponse: Xiecheng.XcCancelPreOrderSuccessBody | null;
    cancelledOrder: Order.OrderWithItems;
    records: Xiecheng.XcOrderSyncRecord[];
  }>) => {
    const { Given, And, When, Then, context } = s;

    Given('携程 service name 是 {string} 的订单取消请求', (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
      context.serviceName = serviceName;
      context.draftCancelOrderBody = {
        sequenceId: `xc_cancel_seq_${Date.now()}`,
        otaOrderId: featureContext.draftOrder!.otaOrderId,
      };
    });

    And('携程订单取消请求中的 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      context.draftCancelOrderBody.otaOrderId = otaOrderId;
    });

    And('携程订单取消请求中的 sequence id 是 {string}', (_ctx, sequenceId: string) => {
      context.draftCancelOrderBody.sequenceId = sequenceId;
    });

    When('携程发送订单取消请求', async () => {
      const notification = buildCtripOrderNotification(
        config.xiecheng,
        context.serviceName,
        context.draftCancelOrderBody,
      );

      context.cancelOrderResponse = await sendCtripOrderCallback(
        featureContext.apiServer,
        notification,
      );
    });

    Then('cr7 系统按照携程的要求返回订单取消响应', async () => {
      const { adminToken, apiServer, order } = featureContext;
      const { cancelOrderResponse } = context;
      assertCtripSuccessResponse(cancelOrderResponse);
      context.decryptedCancelResponse = decryptCtripResponseBody<
        Xiecheng.XcCancelPreOrderSuccessBody
      >(
        cancelOrderResponse,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );

      context.cancelledOrder = await getOrderAdmin(
        apiServer,
        order!.id,
        adminToken,
      );
    });

    And('订单取消响应中包含 supplier order id', () => {
      const { order } = featureContext;
      expect(context.decryptedCancelResponse?.supplierOrderId).toBe(order?.id);
    });

    And('订单取消响应中包含 ota order id {string}', (_ctx, otaOrderId: string) => {
      expect(context.decryptedCancelResponse?.otaOrderId).toBe(otaOrderId);
    });

    And('订单取消响应中订单状态为已取消，值为 {int}', (_ctx, statusValue: number) => {
      expect(context.cancelledOrder.status).toBe('CANCELLED');
      expect(context.decryptedCancelResponse?.items[0]).toHaveProperty('orderStatus', statusValue);
    });

    When('管理员在系统后台查询订单号 {string} 的携程同步记录', async (_ctx, otaOrderId: string) => {
      const { adminToken, apiServer, order } = featureContext;
      const records = await getCtripOrderSyncRecords(apiServer, adminToken, order!.id);
      expect(records.length).toBeGreaterThanOrEqual(2);
      expect(records[0].ota_order_id).toBe(otaOrderId);
      context.records = records;
    });

    And('同步记录内容包含订单号 {string}，序列号 {string}, 同步状态是成功', (_ctx, otaOrderId: string, sequenceId: string) => {
      const latestRecord = context.records[0];
      expect(latestRecord.ota_order_id).toBe(otaOrderId);
      expect(latestRecord.sequence_id).toBe(sequenceId);
      expect(latestRecord.sync_status).toBe('SUCCESS');
      expect(latestRecord.service_name).toBe('CancelPreOrder');
    });

    And('同步记录中的 supplier order id 是用户创建的订单 id', () => {
      const latestRecord = context.records[0];
      expect(latestRecord.order_id).toBe(featureContext.order?.id);
    });

    And('同步记录中包含订单状态变更为已取消，值为 {int}', (_ctx, statusValue: number) => {
      const latestRecord = context.records[0];
      const responseBody = latestRecord.response_body as Xiecheng.XcCancelPreOrderSuccessBody;
      expect(responseBody.items).toHaveLength(1);
      expect(responseBody.items[0]).toHaveProperty('orderStatus', statusValue);
    });
  });

  Scenario('用户完成支付携程下单的门票订单', (s: StepTest<{
    records: Xiecheng.XcOrderSyncRecord[];
  }>) => {
    const { And, When, context } = s;

    And('订单支付响应中包含 supplier order id', () => {
      const { order, decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.supplierOrderId).toBe(order?.id);
    });

    And('订单支付响应中包含 ota order id {string}', (_ctx, otaOrderId: string) => {
      const { decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.otaOrderId).toBe(otaOrderId);
    });

    And('订单支付响应中包含 supplier confirm type 是 {int}', (_ctx, confirmType: number) => {
      const { decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.supplierConfirmType).toBe(confirmType);
    });

    And('订单支付响应中的凭证发送方是携程，值为 {int}', (_ctx, sender: number) => {
      const { decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.voucherSender).toBe(sender);
    });

    And('订单支付响应中的凭证类型是二维码图片，值为 {int}', (_ctx, voucherType: number) => {
      const { decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.vouchers[0]?.voucherType).toBe(voucherType);
    });

    And('订单支付响应中的凭证 id 是订单核销码 id', () => {
      const { decryptedPayResponse, redemption } = featureContext;
      expect(decryptedPayResponse!.vouchers[0]?.voucherId).toBe(redemption!.order_id);
    });

    And('订单支付响应中的凭证 code 是订单核销码', () => {
      const { decryptedPayResponse, redemption } = featureContext;
      expect(decryptedPayResponse!.vouchers[0]?.voucherCode).toBe(redemption!.code);
    });

    And('订单支付响应中的凭证数据是订单核销码', () => {
      const { decryptedPayResponse, redemption } = featureContext;
      expect(decryptedPayResponse!.vouchers[0]?.voucherData).toBe(redemption!.code);
    });

    And('订单支付响应中的订单项 id 是 {string}', (_ctx, itemId: string) => {
      const { decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.items[0]).toHaveProperty('itemId', itemId);
    });

    And('订单支付响应中的票据信息和出行凭证无关', () => {
      const { decryptedPayResponse } = featureContext;
      expect(decryptedPayResponse!.items[0]).toHaveProperty('isCredentialVouchers', 0);
    });

    When('管理员在系统后台查询订单号 {string} 的携程同步记录', async (_ctx, otaOrderId: string) => {
      const { adminToken, apiServer, order } = featureContext;
      const records = await getCtripOrderSyncRecords(apiServer, adminToken, order!.id);
      expect(records.length).toBeGreaterThanOrEqual(2);
      expect(records[0].ota_order_id).toBe(otaOrderId);
      context.records = records;
    });

    And('同步记录内容包含订单号 {string}，序列号 {string}, 同步状态是成功', (_ctx, otaOrderId: string, sequenceId: string) => {
      const latestRecord = context.records[0];
      expect(latestRecord.ota_order_id).toBe(otaOrderId);
      expect(latestRecord.sequence_id).toBe(sequenceId);
      expect(latestRecord.sync_status).toBe('SUCCESS');
      expect(latestRecord.service_name).toBe('PayPreOrder');
    });

    And('同步记录中的 supplier order id 是用户创建的订单 id', () => {
      const latestRecord = context.records[0];
      expect(latestRecord.order_id).toBe(featureContext.order?.id);
    });

    And('同步记录中包含订单状态变更为已支付，值为 {int}', (_ctx, statusValue: number) => {
      const latestRecord = context.records[0];
      const responseBody = latestRecord.response_body as Xiecheng.XcPayPreOrderSuccessBody;
      expect(responseBody.items).toHaveLength(1);
      expect(responseBody.items[0]).toHaveProperty('orderStatus', statusValue);
    });
  });

  Scenario('用户在携程下单后，完成支付后又取消了订单', (s: StepTest<{
      serviceName: Xiecheng.XcOrderServiceName;
      draftRefundOrderBody: Xiecheng.XcCancelOrderBody;
      refundOrderResponse: Xiecheng.XcEncryptedOrderResponse;
      decryptedRefundResponse: Xiecheng.XcCancelOrderSuccessBody;
      refundedOrder: Order.OrderWithItems;
      records: Xiecheng.XcOrderSyncRecord[];
    }>) => {
    const { Given, And, Then, When, context } = s;

    Given('携程 service name 是 {string} 的订单退款请求', (_ctx, serviceName: Xiecheng.XcOrderServiceName) => {
      const { order, draftOrder, draftPayOrderBody } = featureContext;
      context.serviceName = serviceName;
      context.draftRefundOrderBody = {
        supplierOrderId: order!.id,
        otaOrderId: draftOrder!.otaOrderId,
        sequenceId: 'xc_cancel_order_seq_54321',
        items: [
          {
            itemId: draftPayOrderBody!.items[0].itemId,
            PLU: featureContext.order!.items[0].ticket_category_id,
            lastConfirmTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            cancelType: 0,
            quantity: 1,
            passengers: [],
            amount: 100,
            amountCurrency: 'CNY'
          }
        ],
      };
    });

    And('订单退款请求里的订单项 id 是 {string}', (_ctx, itemId: string) => {
      context.draftRefundOrderBody.items[0].itemId = itemId;
    });

    And('订单退款请求里的 supplier order id 是用户创建的订单 id', () => {
      context.draftRefundOrderBody.supplierOrderId = featureContext.order!.id;
    });

    And('订单退款请求里的 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      context.draftRefundOrderBody.otaOrderId = otaOrderId;
    });

    When('携程发送订单退款请求', async () => {
      const notification = buildCtripOrderNotification(
        config.xiecheng,
        context.serviceName,
        context.draftRefundOrderBody,
      );

      context.refundOrderResponse = await sendCtripOrderCallback(
        featureContext.apiServer,
        notification,
      );
    });

    Then('cr7 系统按照携程的要求返回订单退款响应', async () => {
      const { adminToken, apiServer, order } = featureContext;
      assertCtripSuccessResponse(context.refundOrderResponse);

      context.decryptedRefundResponse = decryptCtripResponseBody<Xiecheng.XcCancelOrderSuccessBody>(
        context.refundOrderResponse,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );

      context.refundedOrder = await getOrderAdmin(
        apiServer,
        order!.id,
        adminToken,
      );
    });

    And('订单退款响应中 supplier confirm type 为 取消已确认，值为 {int}', (_ctx, confirmType: number) => {
      expect(context.decryptedRefundResponse.supplierConfirmType).toBe(confirmType);
    });

    And('订单退款响应中订单项 id 是 {string}', (_ctx, itemId: string) => {
      expect(context.decryptedRefundResponse.items).toHaveLength(1);
      expect(context.decryptedRefundResponse.items[0]).toHaveProperty('itemId', itemId);
    });

    And('订单退款响应中的凭证 id 为订单核销码 id', () => {
      const { redemption } = featureContext;
      expect(context.decryptedRefundResponse.items[0].vouchers).toHaveLength(1);
      expect(context.decryptedRefundResponse.items[0].vouchers[0]).toHaveProperty('voucherId', redemption?.order_id);
    });

    Then('订单状态变为已退款', () => {
      expect(context.refundedOrder.status).toBe('REFUNDED');
    });

    When('管理员在系统后台查询订单号 {string} 的携程同步记录', async (_ctx, otaOrderId: string) => {
      const { adminToken, apiServer, order } = featureContext;
      const records = await getCtripOrderSyncRecords(apiServer, adminToken, order!.id);
      expect(records.length).toBeGreaterThanOrEqual(3);
      expect(records[0].ota_order_id).toBe(otaOrderId);
      context.records = records;
    });

    And('同步记录内容包含订单号 {string}，序列号 {string}, 同步状态是成功', (_ctx, otaOrderId: string, sequenceId: string) => {
      const latestRecord = context.records[0];
      expect(latestRecord.ota_order_id).toBe(otaOrderId);
      expect(latestRecord.sequence_id).toBe(sequenceId);
      expect(latestRecord.sync_status).toBe('SUCCESS');
      expect(latestRecord.service_name).toBe('CancelOrder');
    });

    And('同步记录中的 supplier order id 是用户创建的订单 id', () => {
      const latestRecord = context.records[0];
      expect(latestRecord.order_id).toBe(featureContext.order?.id);
    });

    And('订单查询响应中订单项的 item id 因为订单已经支付过，所以为 {string}', (_ctx, itemId: string) => {
      const { decryptedQueryResponse } = featureContext;
      expect(decryptedQueryResponse!.items).toHaveLength(1);
      expect(decryptedQueryResponse!.items[0]).toHaveProperty('itemId', itemId);
    });

    And('订单查询响应中订单状态为全部取消，值为 {int}', (_ctx, statusValue: number) => {
      const { decryptedQueryResponse } = featureContext;
      expect(decryptedQueryResponse!.items).toHaveLength(1);
      expect(decryptedQueryResponse!.items[0]).toHaveProperty('orderStatus', statusValue);
    });
  });

  Scenario('核销用户在携程上购买的门票', (s: StepTest<{
    ctripConsumedMockServer: MockServer;
    ctripConsumedMockHandler: ReturnType<typeof vi.fn>;
    receivedConsumedNoticeBody: Xiecheng.XcOrderConsumedNoticeBody;
  }>) => {
    const { Given, When, Then, And, context } = s;

    Given('携程服务已经准备好接受核销通知', async () => {
      const handler = vi.fn().mockResolvedValue({
        header: { resultCode: '0000', resultMessage: '操作成功' },
      });
      const server = await mockJSONServer(handler);
      vi.spyOn(config.xiecheng, 'base_url', 'get').mockReturnValue(server.address);
      context.ctripConsumedMockHandler = handler;
      context.ctripConsumedMockServer = server;
    });

    When('"管理员" 核销了订单', async () => {
      const { apiServer, adminToken, exhibition, redemption } = featureContext;
      await redeemCode(apiServer, exhibition.id, redemption!.code, adminToken);
    });

    Then('携程服务收到了订单核销通知', async () => {
      const { ctripConsumedMockHandler, ctripConsumedMockServer } = context;
      await ctripConsumedMockServer.close();
      expect(ctripConsumedMockHandler).toHaveBeenCalledOnce();
      const callArg = ctripConsumedMockHandler.mock.calls[0][0] as {
        body: Xiecheng.XcEncryptedOrderNotification;
      };
      context.receivedConsumedNoticeBody = decryptCtripResponseBody<Xiecheng.XcOrderConsumedNoticeBody>(
        callArg.body as unknown as Xiecheng.XcEncryptedOrderResponse,
        config.xiecheng.aes_key,
        config.xiecheng.aes_iv,
      );
    });

    And('核销通知中的 sequence id 是 cr7 核销记录的 id', () => {
      expect(context.receivedConsumedNoticeBody.sequenceId).toBe(featureContext.redemption!.order_id);
    });

    And('核销通知中的 ota order id 是 {string}', (_ctx, otaOrderId: string) => {
      expect(context.receivedConsumedNoticeBody.otaOrderId).toBe(otaOrderId);
    });

    And('核销通知中的 supplier order id 是用户创建的订单 id', () => {
      expect(context.receivedConsumedNoticeBody.supplierOrderId).toBe(featureContext.order!.id);
    });

    And('核销通知中包含订单项 id {string}', (_ctx, itemId: string) => {
      expect(context.receivedConsumedNoticeBody.items).toHaveLength(1);
      expect(context.receivedConsumedNoticeBody.items[0]).toHaveProperty('itemId', itemId);
    });
  });
});
