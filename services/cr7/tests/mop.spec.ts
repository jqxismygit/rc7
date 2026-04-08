import { Server } from 'node:http';
import config from 'config';
import { ServiceBroker } from 'moleculer';
import type { Mock, MockInstance } from 'vitest';
import { expect, vi } from 'vitest';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Exhibition, Inventory, Mop, Order, Redeem, User } from '@cr7/types';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { listUsers, prepareAdminToken } from './fixtures/user.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
  updateExhibition,
} from './fixtures/exhibition.js';
import { getSessionTickets, updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { redeemCode } from './fixtures/redeem.js';
import {
  MopEncryptedResponse,
  getMopOrderSyncRecords,
  MopOrderCreateRequest,
  MopOrderStatusChangeRequest,
  MopOrderQueryRequest,
  MopOrderQueryResponseData,
  MopOrderSyncResponseData,
  MopTicketConfirmationRequest,
  MopTicketConfirmationResponse,
  parseMopEncryptedResponse,
  queryMopOrderFromCr7,
  sendMopOrderStatusChange,
  sendMopTicketConfirmation,
  verifyMopResponseSign,
  setupMopMockServer,
  syncExhibitionToMop,
  syncMopOrderToCr7,
  syncSessionsToMop,
  syncTicketsToMop,
  SyncTicketsToMopRequest,
  SyncSessionsToMopRequest,
} from './fixtures/mop.js';
import { toDateLabel } from './lib/relative-date.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { MockServer } from './lib/server.js';
import { getOrderAdmin } from './fixtures/order.js';

const schema = 'test_mop';
const services = ['api', 'user', 'cr7', 'mop'];

const feature = await loadFeature('tests/features/mop.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

type MopShow = SyncSessionsToMopRequest['shows'][number];

function normalizeTimeLabel(time: string): string {
  const secondPrecision = parse(time, 'HH:mm:ss', new Date());
  if (!Number.isNaN(secondPrecision.getTime()) && format(secondPrecision, 'HH:mm:ss') === time) {
    return time;
  }

  const minutePrecision = parse(time, 'HH:mm', new Date());
  if (!Number.isNaN(minutePrecision.getTime()) && format(minutePrecision, 'HH:mm') === time) {
    return format(minutePrecision, 'HH:mm:ss');
  }

  return time;
}

function toSessionDateLabel(value: Date | string): string {
  const dateValue = isDate(value) ? value : parseISO(value);
  if (Number.isNaN(dateValue.getTime())) {
    return String(value).slice(0, 10);
  }

  return format(dateValue, 'yyyy-MM-dd');
}

function getMopRequestArg(mockHandler: Mock) {
  expect(mockHandler).toHaveBeenCalled();
  const call = mockHandler.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call?.[0] as { uri: string; body: unknown };
}

const DATETIME_LABEL_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

interface MopServerContext {
  mopRequestHandler: Mock<
  (request: { uri: string; body: unknown }) => Promise<{ code: number; msg: string; body?: unknown }>
  >;
}

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  ticketByName: TicketByName;
}

interface OrderContext {
  mopOrderDraft: MopOrderCreateRequest;
  mopOrderEnvelope: MopEncryptedResponse;
  mopOrderBody: MopOrderSyncResponseData | null;
  orderUser: User.Profile;
  order: Order.OrderWithItems;
  records: Mop.MopOrderSyncRecord[];
}

interface OrderQueryContext {
  mopOrderQueryDraft: MopOrderQueryRequest;
  mopOrderQueryEnvelope: MopEncryptedResponse;
  mopOrderQueryBody: MopOrderQueryResponseData | null;
}

interface TicketConfirmationContext {
  mopTicketDraft: MopTicketConfirmationRequest;
  mopTicketEnvelope: MopEncryptedResponse;
  mopTicketBody: MopTicketConfirmationResponse | null;
  orderRedemption: Redeem.RedemptionCodeWithOrder;
}

interface OrderStatusChangeContext {
  mopOrderStatusChangeDraft: MopOrderStatusChangeRequest;
  mopOrderStatusChangeEnvelope: MopEncryptedResponse;
}

interface FeatureContext extends
  ExhibitionContext,
  MopServerContext,
  Partial<OrderContext>,
  Partial<OrderQueryContext>,
  Partial<TicketConfirmationContext>,
  Partial<OrderStatusChangeContext> {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
}

const CITY_BY_NAME: Record<string, { id: string; name: string }> = {
  上海: {
    id: '310000',
    name: '上海市',
  },
};

const openedMockServers: MockServer[] = [];
const openedSpies: MockInstance[] = [];

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
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
    while (openedMockServers.length > 0) {
      const server = openedMockServers.pop();
      if (server) {
        server.close();
      }
    }

    while (openedSpies.length > 0) {
      const spy = openedSpies.pop();
      if (spy) {
        spy.mockRestore();
      }
    }
    for (const [key] of Object.entries(featureContext)) {
      if (['broker', 'apiServer'].includes(key)) {
        continue;
      }
      Object.assign(featureContext, { [key]: undefined });
    }
  });

  defineSteps(({ Given, When, And, Then }) => {
    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天, 价格为 {int} 元', async (
      _ctx,
      ticketName: string,
      admittance: number,
      price: number,
    ) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      const ticket = await prepareTicketCategory(
        apiServer,
        adminToken,
        exhibition.id,
        {
          name: ticketName,
          admittance,
          price,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
        },
      );

      featureContext.ticketByName = {
        ...featureContext.ticketByName,
        [ticketName]: ticket,
      };
    });

    And('{string} 库存为 {int}', async (_ctx, ticketName: string, quantity: number) => {
      const { apiServer, adminToken, ticketByName, exhibition } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      await updateTicketCategoryMaxInventory(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        quantity,
      );
    });

    Then('猫眼收到请求可以正常解密，签名无误', () => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.anything(),
        uri: expect.anything()
      }));
    });

    And('票种同步消息中的第 {int} 个票种名称是 {string}', (_ctx, index: number, ticketName: string) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      expect(body.skus[index - 1]).toBeTruthy();
      expect(body.skus[index - 1].name).toBe(ticketName);
    });

    And('票种同步消息中的第 {int} 个票种 ID 是 {string} 的 ID', (
      _ctx,
      index: number,
      ticketName: string,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      expect(body.skus[index - 1]).toBeTruthy();
      expect(body.skus[index - 1].otSkuId).toBe(ticket.id);
    });

    And('票种同步消息中的第 {int} 个票种状态是有效，值为 {int}', (
      _ctx,
      index: number,
      status: number,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      expect(body.skus[index - 1]).toBeTruthy();
      expect(body.skus[index - 1].otSkuStatus).toBe(status);
    });

    And('票种同步消息中的第 {int} 个票种的票面价是 {string} 的价格，单位为元', (
      _ctx,
      index: number,
      ticketName: string,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      const expectedPriceYuan = Number((ticket.price / 100).toFixed(2));
      expect(body.skus[index - 1]).toBeTruthy();
      expect(Number(body.skus[index - 1].skuPrice)).toBe(expectedPriceYuan);
    });

    And('票种同步消息中的第 {int} 个票种的售卖价是 {string} 的价格，单位为元', (
      _ctx,
      index: number,
      ticketName: string,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      const expectedPriceYuan = Number((ticket.price / 100).toFixed(2));
      expect(body.skus[index - 1]).toBeTruthy();
      expect(Number(body.skus[index - 1].sellPrice)).toBe(expectedPriceYuan);
    });

    And('票种同步消息中的第 {int} 个票种的开售时间是展会的开售日期和开始时间的组合', (
      _ctx,
      index: number,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      const expected = `${toSessionDateLabel(featureContext.exhibition.start_date)} ${normalizeTimeLabel(featureContext.exhibition.opening_time)}`;
      expect(body.skus[index - 1]).toBeTruthy();
      expect(body.skus[index - 1].onSaleTime).toBe(expected);
    });

    And('票种同步消息中的第 {int} 个票种的停售时间是展会的结束日期和结束时间的组合', (
      _ctx,
      index: number,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      const expected = `${toSessionDateLabel(featureContext.exhibition.end_date)} ${normalizeTimeLabel(featureContext.exhibition.closing_time)}`;
      expect(body.skus[index - 1]).toBeTruthy();
      expect(body.skus[index - 1].offSaleTime).toBe(expected);
    });

    And('票种同步消息中的第 {int} 个票种的库存模式是共享库存，值为 {int}', (
      _ctx,
      index: number,
      inventoryType: number,
    ) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      expect(body.skus[index - 1]).toBeTruthy();
      expect(body.skus[index - 1].inventoryType).toBe(inventoryType);
    });

    // 创建订单
    Given('用户在猫眼创建了订单', async () => {
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const todayLabel = toDateLabel('今天');
      const todaySession = sessions.find(
        item => toSessionDateLabel(item.session_date) === todayLabel
      );
      expect(todaySession).toBeTruthy();

      featureContext.mopOrderDraft = {
        myOrderId: `mop_order_${Date.now()}`,
        projectCode: featureContext.exhibition.id,
        projectShowCode: todaySession!.id,
        buyerName: 'Alice',
        buyerPhone: '13800000000',
        totalPrice: '0.00',
        needSeat: false,
        needRealName: false,
        ticketInfo: [],
      };
    });

    And('猫眼订单中的订单 ID 是 {string}', (_ctx, orderId: string) => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.myOrderId = orderId;
    });

    And('猫眼订单中的项目编码是默认展会活动的 ID', () => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.projectCode = featureContext.exhibition.id;
    });

    And('猫眼订单中的场次 ID 是 {string} 的场次 ID', async (_ctx, dayLabel: string) => {
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedDate = toDateLabel(dayLabel);
      const expectedSession = sessions.find(item => toSessionDateLabel(item.session_date) === expectedDate);
      expect(expectedSession).toBeTruthy();
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.projectShowCode = expectedSession!.id;
    });

    And('猫眼订单中的购买人信息是 {string}', (_ctx, buyerName: string) => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.buyerName = buyerName;
    });

    And('猫眼订单中的手机号是 {string}', (_ctx, phone: string) => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.buyerPhone = phone;
    });

    And('猫眼订单中选座信息是不需要选座', () => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.needSeat = false;
    });

    And('猫眼订单中是非实名', () => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.needRealName = false;
    });

    And('猫眼订单中有 {int} 个订单项', (_ctx, count: number) => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      featureContext.mopOrderDraft!.ticketInfo = Array.from({ length: count }, () => ({
        myTicketId: '',
        skuId: '',
        ticketPrice: '0.00',
      }));
    });

    And('猫眼订单中的第 {int} 个订单项的 sku ID 是 {string} 的 ID', (
      _ctx,
      index: number,
      ticketName: string,
    ) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      expect(featureContext.mopOrderDraft).toBeTruthy();
      expect(featureContext.mopOrderDraft!.ticketInfo[index - 1]).toBeTruthy();
      featureContext.mopOrderDraft!.ticketInfo[index - 1].skuId = ticket.id;
    });

    And('猫眼订单中的第 {int} 个订单项的猫眼 ID 是 {string}', (
      _ctx,
      index: number,
      myTicketId: string,
    ) => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      expect(featureContext.mopOrderDraft!.ticketInfo[index - 1]).toBeTruthy();
      featureContext.mopOrderDraft!.ticketInfo[index - 1].myTicketId = myTicketId;
    });

    And('猫眼订单中的第 {int} 个订单项的价格是 {string} 的价格，单位为元', (
      _ctx,
      index: number,
      ticketName: string,
    ) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      expect(featureContext.mopOrderDraft).toBeTruthy();
      expect(featureContext.mopOrderDraft!.ticketInfo[index - 1]).toBeTruthy();
      featureContext.mopOrderDraft!.ticketInfo[index - 1].ticketPrice = (ticket.price / 100).toFixed(2);
    });

    And('猫眼订单中的订单总金额是 {int} 个订单项的价格之和，单位为元', (_ctx, itemCount: number) => {
      expect(featureContext.mopOrderDraft).toBeTruthy();
      expect(featureContext.mopOrderDraft!.ticketInfo).toHaveLength(itemCount);
      const totalPrice = featureContext.mopOrderDraft!.ticketInfo
      .reduce((sum, item) => sum + Number(item.ticketPrice), 0);
      featureContext.mopOrderDraft!.totalPrice = totalPrice.toFixed(2);
    });

    Then('默认展会活动的 {string} 在 {string} 的库存为 {int}', async (
      _ctx,
      ticketName: string,
      dayLabel: string,
      expectedQuantity: number,
    ) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const targetDate = toDateLabel(dayLabel);
      const targetSession = sessions.find(
        item => toSessionDateLabel(item.session_date) === targetDate,
      );
      expect(targetSession).toBeTruthy();

      const sessionTickets = await getSessionTickets(
        apiServer,
        adminToken,
        exhibition.id,
        targetSession!.id,
      );
      const sessionTicket = sessionTickets.find((item: Inventory.SessionTicketsInventory) => item.id === ticket.id);
      expect(sessionTicket).toBeTruthy();
      expect(sessionTicket!.quantity).toBe(expectedQuantity);
    });

    Then('默认展会活动的 {string} 在 {string} 的库存保持为 {int}', async (
      _ctx,
      ticketName: string,
      dayLabel: string,
      expectedQuantity: number,
    ) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const targetDate = toDateLabel(dayLabel);
      const targetSession = sessions.find(
        item => toSessionDateLabel(item.session_date) === targetDate,
      );
      expect(targetSession).toBeTruthy();

      const sessionTickets = await getSessionTickets(
        apiServer,
        adminToken,
        exhibition.id,
        targetSession!.id,
      );
      const sessionTicket = sessionTickets.find((item: Inventory.SessionTicketsInventory) => item.id === ticket.id);
      expect(sessionTicket).toBeTruthy();
      expect(sessionTicket!.quantity).toBe(expectedQuantity);
    });

    When('猫眼将订单同步消息发送给 cr7', async () => {
      const { apiServer, mopOrderDraft } = featureContext;
      featureContext.mopOrderEnvelope = await syncMopOrderToCr7(apiServer, mopOrderDraft!);
    });

    Then('cr7 收到订单同步消息，可以正常验证签名，解密无误', async () => {
      const { mopOrderEnvelope } = featureContext;
      await verifyMopResponseSign('/mop/order', mopOrderEnvelope!);
      featureContext.mopOrderBody = await parseMopEncryptedResponse<MopOrderSyncResponseData>(
        mopOrderEnvelope!
      );
    });

    Then(
      'cr7 添加了一个新用户，手机号是 {string}，姓名是 {string}',
      async (_ctx, phone: string, name: string) => {
      const { mopOrderDraft, apiServer, adminToken } = featureContext;
      const { buyerPhone, buyerName } = mopOrderDraft!;
      const { total, users } = await listUsers(apiServer, adminToken!, { phone: buyerPhone });
      expect(total).toEqual(1);
      const user = users[0];
      expect(user).toBeTruthy();
      expect(user.phone).toEqual(`+86 ${buyerPhone}`);
      expect(user.name).toEqual(buyerName);
      featureContext.orderUser = user;
    });

    Then('cr7 创建了一个订单，来源为 {string}, 状态为待支付', async (_ctx, source: string) => {
      const { mopOrderBody, apiServer, adminToken } = featureContext;
      const { channelOrderId } = mopOrderBody!;
      const order = await getOrderAdmin(apiServer, channelOrderId, adminToken!);
      expect(order.status).toEqual('PENDING_PAYMENT');
      expect(order.source).toEqual(source);
      featureContext.order = order;
    });

    And(
      '订单的第 {int} 个订单项是 {string}，数量为 {int}，价格为票价，单位为元',
      (_ctx, index: number, ticketName: string, quantity: number) => {
      const { order } = featureContext;
      const item = order!.items[index - 1];
      expect(item).toBeTruthy();
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      expect(item.quantity).toEqual(quantity);
      expect(item.unit_price).toEqual(ticket.price);
      expect(item.ticket_category_id).toEqual(ticket.id);
    });

    // 查询订单
    Given('用户在猫眼查看订单 {string} 的详情', async (_ctx, myOrderId: string) => {
      featureContext.mopOrderQueryDraft = { myOrderId };
      const { apiServer, mopOrderQueryDraft } = featureContext;
      featureContext.mopOrderQueryEnvelope = await queryMopOrderFromCr7(apiServer, mopOrderQueryDraft!);
    });

    When('cr7 收到猫眼订单查询请求，签名验证通过，解密无误', async () => {
      const { mopOrderQueryEnvelope } = featureContext;
      await verifyMopResponseSign('/mop/orderQuery', mopOrderQueryEnvelope!);
      featureContext.mopOrderQueryBody = await parseMopEncryptedResponse<MopOrderQueryResponseData>(
        mopOrderQueryEnvelope!
      );
    });

    Then('cr7 返回订单详情给猫眼', () => {
      const { mopOrderQueryEnvelope } = featureContext;
      expect(mopOrderQueryEnvelope).toHaveProperty('code');
      expect(mopOrderQueryEnvelope).toHaveProperty('msg');
      expect(mopOrderQueryEnvelope).toHaveProperty('sign');
      expect(mopOrderQueryEnvelope).toHaveProperty('encryptData');
    });

    And('订单详情中的猫眼订单 ID 是 {string}', (_ctx, myOrderId: string) => {
      expect(featureContext.mopOrderQueryBody!.myOrderId).toBe(myOrderId);
    });

    And('订单详情中的订单状态为初始状态， 值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderStatus).toBe(status);
    });

    And('订单详情中的订单状态为已出票，值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderStatus).toBe(status);
    });

    And('订单详情中的订单状态为已出票， 值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderStatus).toBe(status);
    });

    And('订单详情中的退款状态为未发起，值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderRefundStatus).toBe(status);
    });

    And('订单详情中的核销状态为未消费，值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderConsumeStatus).toBe(status);
    });

    And('订单详情中的核销状态为已消费，值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderConsumeStatus).toBe(status);
    });

    And('订单详情中的订单状态为已取消，值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderStatus).toBe(status);
    });

    And('订单详情中的取票码为 null，取票二维码为 null', () => {
      expect(featureContext.mopOrderQueryBody!.fetchCode).toBeNull();
      expect(featureContext.mopOrderQueryBody!.fetchQrCode).toBeNull();
    });

    And('订单详情中的有 {int} 个订单项', (_ctx, itemCount: number) => {
      expect(featureContext.mopOrderQueryBody!.ticketInfo).toHaveLength(itemCount);
    });

    And('订单详情中有 {int} 个订单项', (_ctx, itemCount: number) => {
      expect(featureContext.mopOrderQueryBody!.ticketInfo).toHaveLength(itemCount);
    });

    And('订单详情中的第 {int} 个订单项的猫眼 ID 是 {string}', (_ctx, index: number, myTicketId: string) => {
      expect(featureContext.mopOrderQueryBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(featureContext.mopOrderQueryBody!.ticketInfo[index - 1].myTicketId).toBe(myTicketId);
    });

    And('订单详情中的第 {int} 个订单项的渠道票 ID 是 {string} 的 ID', (_ctx, index: number, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      expect(featureContext.mopOrderQueryBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(featureContext.mopOrderQueryBody!.ticketInfo[index - 1].channelTicketId).toBe(ticket.id);
    });

    And('订单详情中的第 {int} 个订单项的核销状态为未消费，值为 {int}', (_ctx, index: number, status: number) => {
      expect(featureContext.mopOrderQueryBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(featureContext.mopOrderQueryBody!.ticketInfo[index - 1].ticketConsumeStatus).toBe(status);
    });

    And('订单详情中的第 {int} 个订单项的检票码是 cr7 订单的核销码', (_ctx, index: number) => {
      const { mopOrderQueryBody, orderRedemption } = featureContext;
      expect(orderRedemption).toBeTruthy();
      expect(mopOrderQueryBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopOrderQueryBody!.ticketInfo[index - 1].checkCode).toBe(orderRedemption!.code);
    });

    And('订单详情中的第 {int} 个订单项的检票二维码是 cr7 订单的核销码', (_ctx, index: number) => {
      const { mopOrderQueryBody, orderRedemption } = featureContext;
      expect(orderRedemption).toBeTruthy();
      expect(mopOrderQueryBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopOrderQueryBody!.ticketInfo[index - 1].checkQrCode).toBe(orderRedemption!.code);
    });

    // 支付
    Given('用户在猫眼支付了订单 {string}', (_ctx, myOrderId: string) => {
      featureContext.mopTicketDraft = { myOrderId };
    });

    When('cr7 收到猫眼的支付结果通知，签名验证通过，解密无误', async () => {
      const { apiServer, mopTicketDraft } = featureContext;
      featureContext.mopTicketEnvelope = await sendMopTicketConfirmation(apiServer, mopTicketDraft!);
    });

    Then('cr7 订单状态变更为已经支付', async () => {
      const { apiServer, adminToken, mopOrderBody } = featureContext;
      const { channelOrderId } = mopOrderBody!;
      const paidOrder = await getOrderAdmin(apiServer, channelOrderId, adminToken!);
      featureContext.order = paidOrder;
      expect(paidOrder.status).toBe('PAID');
    });

    And('cr7 订单生成了核销码', async () => {
      const { broker, order } = featureContext;
      expect(order).toBeTruthy();
      featureContext.orderRedemption = await broker.call<
        Redeem.RedemptionCodeWithOrder, { oid: string }
      >(
        'cr7.redemption.getByOrder',
        { oid: order!.id },
        { meta: { user: { uid: order!.user_id } } },
      );
    });

    Then('cr7 返回了订单支付结果', async () => {
      const { mopTicketEnvelope } = featureContext;
      expect(mopTicketEnvelope).toHaveProperty('code');
      expect(mopTicketEnvelope).toHaveProperty('msg');
      expect(mopTicketEnvelope).toHaveProperty('sign');
      expect(mopTicketEnvelope).toHaveProperty('encryptData');
      await verifyMopResponseSign('/mop/ticket', mopTicketEnvelope!);
      featureContext.mopTicketBody = await parseMopEncryptedResponse<MopTicketConfirmationResponse>(
        mopTicketEnvelope!
      );
    });

    // 取消订单
    Given('用户在猫眼取消了订单 {string}', (_ctx, myOrderId: string) => {
      featureContext.mopOrderStatusChangeDraft = {
        myOrderId,
        bizType: 0,
      };
    });

    When('cr7 收到猫眼的取消通知，签名验证通过，解密无误', async () => {
      const { apiServer, mopOrderStatusChangeDraft } = featureContext;
      featureContext.mopOrderStatusChangeEnvelope = await sendMopOrderStatusChange(
        apiServer,
        mopOrderStatusChangeDraft!,
      );
      await verifyMopResponseSign('/mop/orderStatusChange', featureContext.mopOrderStatusChangeEnvelope);
    });

    Then('cr7 订单状态变更为已取消', async () => {
      const { apiServer, adminToken, mopOrderBody } = featureContext;
      const cancelledOrder = await getOrderAdmin(
        apiServer,
        mopOrderBody!.channelOrderId,
        adminToken!,
      );
      featureContext.order = cancelledOrder;
      expect(cancelledOrder.status).toBe('CANCELLED');
    });

    Then('cr7 返回了订单取消结果', () => {
      const { mopOrderStatusChangeEnvelope } = featureContext;
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('code');
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('msg');
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('sign');
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('encryptData');
      expect(mopOrderStatusChangeEnvelope!.code).toBe(10000);
    });

    And('订单取消结果中的 encrypt data 为 null', () => {
      expect(featureContext.mopOrderStatusChangeEnvelope!.encryptData).toBeNull();
    });

    // 退款订单
    Given('用户在猫眼对订单 {string} 申请了退款', (_ctx, myOrderId: string) => {
      featureContext.mopOrderStatusChangeDraft = {
        myOrderId,
        bizType: 1,
      };
    });

    When('cr7 收到猫眼的退款通知，签名验证通过，解密无误', async () => {
      const { apiServer, mopOrderStatusChangeDraft } = featureContext;
      featureContext.mopOrderStatusChangeEnvelope = await sendMopOrderStatusChange(
        apiServer,
        mopOrderStatusChangeDraft!,
      );
      await verifyMopResponseSign('/mop/orderStatusChange', featureContext.mopOrderStatusChangeEnvelope);
    });

    And('猫眼退款消息中的状态值为 {int}，表示用户申请了退款', (_ctx, status: number) => {
      expect(featureContext.mopOrderStatusChangeDraft).toBeTruthy();
      expect(featureContext.mopOrderStatusChangeDraft!.bizType).toBe(status);
      expect(featureContext.mopOrderStatusChangeDraft!.bizType).toBe(1);
    });


    Then('cr7 订单状态变更为已退款', async () => {
      const { apiServer, adminToken, mopOrderBody } = featureContext;
      const refundedOrder = await getOrderAdmin(
        apiServer,
        mopOrderBody!.channelOrderId,
        adminToken!,
      );
      featureContext.order = refundedOrder;
      expect(refundedOrder.status).toBe('REFUNDED');
    });

    And('cr7 订单的核销码失效', async () => {
      const { broker, order } = featureContext;
      expect(order).toBeTruthy();
      await expect(
        broker.call('cr7.redemption.getByOrder',
          { oid: order!.id },
          { meta: { user: { uid: order!.user_id } } },
        )
      ).rejects.toMatchObject({
        code: 410,
        type: 'ORDER_NOT_REDEEMABLE',
      });
    });

    Then('cr7 返回了订单退款结果', () => {
      const { mopOrderStatusChangeEnvelope } = featureContext;
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('code');
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('msg');
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('sign');
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('encryptData');
      expect(mopOrderStatusChangeEnvelope!.code).toBe(10000);
    });

    // records
    When('管理员第 {int} 次查看猫眼订单同步记录', async () => {
      const { apiServer, adminToken, order } = featureContext;
      featureContext.records = await getMopOrderSyncRecords(
        apiServer, adminToken, order!.id
      );
    });

    Then('订单同步记录里有 {int} 条记录', (_ctx, count: number) => {
      const { records } = featureContext;
      expect(records).toHaveLength(count);
    });

    And('第 {int} 次查看时，最新的订单同步记录中 request_path 是 {string}， 状态为成功', (_ctx, _checkIndex: number, requestPath: string) => {
      const { records } = featureContext;
      expect(records![0].request_path).toBe(requestPath);
      expect(records![0].sync_status).toBe('SUCCESS');
    });

  })

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema})
    });

    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
    });

    Given('默认展会活动已创建，开始时间为 {string}，结束时间为 {string}', async (
      _ctx,
      startDate: string,
      endDate: string,
    ) => {
      const { apiServer } = featureContext;
      featureContext.exhibition = await prepareExhibition(
        apiServer,
        featureContext.adminToken,
        {
          name: `MOE_${Date.now()}`,
          start_date: toDateLabel(startDate),
          end_date: toDateLabel(endDate),
          city: '上海',
          venue_name: '上海展览中心',
          location: '上海',
        },
      );
      featureContext.ticketByName = {};
    });

    And('默认展会活动的城市是 {string}', async (_ctx, cityName: string) => {
      const city = CITY_BY_NAME[cityName];
      expect(city).toBeTruthy();
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer, adminToken!,
        exhibition.id, { city: cityName },
      );
    });

    Given('猫眼 OTA 已启动', async () => {
      const mopRequestHandler = vi.fn().mockResolvedValue({
        code: 10000,
        msg: '成功'
      });
      const mockMopServer = await setupMopMockServer(mopRequestHandler);
      const baseUrlSpy = vi.spyOn(config.mop, 'base_url', 'get').mockReturnValue(mockMopServer.address);
      openedMockServers.push(mockMopServer);
      openedSpies.push(baseUrlSpy);
      featureContext.mopRequestHandler = mopRequestHandler;
    });
  });

  Scenario('同步展会信息到猫眼', (s: StepTest<void>) => {
    const { Given, When, And } = s;

    Given('cr7 将展会信息同步到猫眼', async () => {
      await syncExhibitionToMop(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('猫眼收到展会同步消息', () => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalled();
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        uri: '/supply/open/mop/project/push'
      }));
    });

    And('展会同步消息中的演出 ID 是默认展会活动的 ID', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          otProjectId: exhibition.id,
        }),
      }));
    });

    And('展会同步消息中的城市 ID 是展会所在城市的 ID', () => {
      const { exhibition, mopRequestHandler } = featureContext;
      const city = CITY_BY_NAME[exhibition.city];
      expect(city).toBeTruthy();
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          cityId: city.id,
        }),
      }));
    });

    And('展会同步消息中的城市名称是展会所在城市的名称', () => {
      const { exhibition, mopRequestHandler } = featureContext;
      const city = CITY_BY_NAME[exhibition.city];
      expect(city).toBeTruthy();
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          cityName: city.name,
        }),
      }));
    });

    And(
      '展会同步消息中的类目是 {string}, 值为 {int}',
      (_ctx, categoryName: string, categoryValue: number) => {
      const { mopRequestHandler } = featureContext;
      expect(categoryName).toBe('休闲展览');
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          category: categoryValue,
        }),
      }));
    });

    And('展会中的场馆 ID 是展会 ID', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          otVenueId: exhibition.id,
        }),
      }));
    });

    And('展会中的场馆名称是展会场馆名称', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          otVenueName: exhibition.venue_name,
        }),
      }));
    });

    And('展会中的项目状态是有效，值为 {int}', (_ctx, status: number) => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          projectStatus: status,
        }),
      }));
    });

    And('展会同步消息中的展会名称是默认展会活动的名称', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          name: exhibition.name,
        }),
      }));
    });
  });

  Scenario('同步场次信息到猫眼', (s: StepTest<void>) => {
    const { Given, When, And } = s;

    Given('cr7 将场次信息同步到猫眼', async () => {
      await syncSessionsToMop(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('猫眼收到场次同步消息', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      expect(request.uri).toBe('/supply/open/mop/show/push');
    });

    And('场次同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      expect(body.otProjectId).toBe(featureContext.exhibition.id);
    });

    And('场次同步消息中有 {int} 个场次', (_ctx, count: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      expect(body.shows).toHaveLength(count);
    });

    And('场次同步消息中的首个场次日期与展会开始日期一致', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const exhibitionStartDate = toSessionDateLabel(featureContext.exhibition.start_date);
      expect(body.shows[0].startTime.startsWith(exhibitionStartDate)).toBe(true);
    });

    And('场次同步消息中的最后一个场次日期与展会结束日期一致', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const lastShow = body.shows.at(-1);
      expect(lastShow).toBeTruthy();
      const exhibitionEndDate = toSessionDateLabel(featureContext.exhibition.end_date);
      expect(lastShow?.startTime.startsWith(exhibitionEndDate)).toBe(true);
    });

    And('场次同步消息中每个场次的 ID 是 cr7 场次 ID', async () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedIds = sessions.map(session => session.id).sort();
      const actualIds = body.shows.map(show => show.otShowId).sort();
      expect(actualIds).toEqual(expectedIds);
    });

    And('场次同步消息中每个场次的状态是有效，值为 {int}', (_ctx, status: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach(show => {
        expect(show.otShowStatus).toBe(status);
      });
    });

    And('场次同步消息中每个场次的开始时间是 cr7 场次的日期和开始时间的组合', async () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedTime = normalizeTimeLabel(featureContext.exhibition.opening_time);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          `${toSessionDateLabel(session.session_date)} ${expectedTime}`,
        ])
      );

      body.shows.forEach(show => {
        expect(show.startTime).toMatch(DATETIME_LABEL_RE);
        expect(show.startTime).toBe(expectedBySessionId.get(show.otShowId));
      });
    });

    And('场次同步消息中每个场次的结束时间是 cr7 场次的日期和结束时间的组合', async () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedTime = normalizeTimeLabel(featureContext.exhibition.closing_time);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          `${toSessionDateLabel(session.session_date)} ${expectedTime}`,
        ])
      );

      body.shows.forEach(show => {
        expect(show.endTime).toMatch(DATETIME_LABEL_RE);
        expect(show.endTime).toBe(expectedBySessionId.get(show.otShowId));
      });
    });

    And('场次同步消息中每个场次的类型是单场票，值为 {int}', (_ctx, showType: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach(show => {
        expect(show.showType).toBe(showType);
      });
    });

    And('场次同步消息中每个场次的取票方式是电子检票码，值为 {int}', (_ctx, fetchType: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach((show: MopShow) => {
        expect(show.fetchTicketWay).toEqual([fetchType]);
      });
    });

    And('场次同步消息中每个场次的每笔订单最大购买份数是 {int}', (_ctx, limit: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach(show => {
        expect(show.maxBuyLimitPerOrder).toBe(limit);
      });
    });

  });

  Scenario('同步票种信息到猫眼', (s: StepTest<void>) => {
    const { Given, When, And } = s;

    Given('cr7 将票种信息同步到猫眼', async () => {
      await syncTicketsToMop(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('猫眼收到票种同步消息', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      expect(request.uri).toBe('/supply/open/mop/sku/push');
    });

    And('票种同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      expect(body.otProjectId).toBe(featureContext.exhibition.id);
    });

    And('票种同步消息中的类型是 OTA 型，值为 {int}', (_ctx, isOta: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      expect(body.isOta).toBe(isOta);
    });

    And('票种同步消息中有 {int} 个票种', (_ctx, count: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncTicketsToMopRequest;
      expect(body.skus).toHaveLength(count);
    });
  });

  Scenario('用户通过猫眼 OTA 创建订单', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;


    And('订单的所有人是新用户 {string}', (_ctx, userName: string) => {
      const { order, orderUser } = featureContext;
      expect(orderUser!.name).toEqual(userName);
      expect(order!.user_id).toEqual(orderUser!.id);
    });

    And('订单的订单项有 {int} 个', (_ctx, itemCount: number) => {
      const { mopOrderDraft, order } = featureContext;
      expect(order!.items).toHaveLength(itemCount);
      const orderItemsMap = new Map(order!.items.map(item => [item.ticket_category_id, item]));
      order!.items = mopOrderDraft!.ticketInfo.map(({ skuId }) => orderItemsMap.get(skuId)!);
    });

    Then('cr7 给猫眼返回了订单同步结果', () => {
      const { mopOrderEnvelope } = featureContext;
      expect(mopOrderEnvelope).toHaveProperty('code');
      expect(mopOrderEnvelope).toHaveProperty('msg');
      expect(mopOrderEnvelope).toHaveProperty('sign');
      expect(mopOrderEnvelope).toHaveProperty('encryptData');
    });

    And('订单同步结果的猫眼订单 ID 是 {string}', (_ctx, myOrderId: string) => {
      const { mopOrderBody } = featureContext;
      expect(mopOrderBody!.myOrderId).toBe(myOrderId);
    });

    And('订单同步结果里的渠道订单 ID 是 cr7 生成的订单 ID', () => {
      const { mopOrderBody, order } = featureContext;
      expect(mopOrderBody!.channelOrderId).toEqual(order!.id);
    });

    And('订单同步结果是订单中 expired at 的时间戳，单位为毫秒', () => {
      const { mopOrderBody, order } = featureContext;
      expect(Number(mopOrderBody!.payExpiredTime)).toEqual(new Date(order!.expires_at).getTime());
    });

    And('订单同步记录里的订单 ID 是 cr7 生成的订单 ID', () => {
      const { records, order } = featureContext;
      const [record] = records!;
      expect(record.order_id).toBe(order!.id);
    });

    When('猫眼再次把相同的订单信息同步给 cr7', async () => {
      const { apiServer, mopOrderDraft } = featureContext;
      featureContext.mopOrderEnvelope = await syncMopOrderToCr7(apiServer, mopOrderDraft!);
    });

    Then('cr7 再次收到订单同步消息，可以正常验证签名，解密无误', async () => {
      const { mopOrderEnvelope } = featureContext;
      await verifyMopResponseSign('/mop/order', mopOrderEnvelope!);
      featureContext.mopOrderBody = await parseMopEncryptedResponse<MopOrderSyncResponseData>(
        mopOrderEnvelope!
      );
    });

    And('最新的订单同步记录里的订单 ID 是 cr7 生成的订单 ID，没有变化', () => {
      const { records, order } = featureContext;
      const [latestRecord, firstRecord] = records!;
      expect(latestRecord.order_id).toBe(order!.id);
      expect(firstRecord.order_id).toBe(order!.id);
    });
  });

  Scenario('用户在猫眼查看订单详情', () => {});

  Scenario('用户在猫眼支付了订单', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;


    And('订单支付结果的猫眼订单 ID 是 {string}', async (_ctx, myOrderId: string) => {
      expect(featureContext.mopTicketBody!.myOrderId).toBe(myOrderId);
    });

    And('订单支付结果的订单状态是已出票，值为 {int}', (_ctx, status: number) => {
      const { mopTicketBody } = featureContext;
      expect(mopTicketBody!.orderStatus).toBe(status);
    });

    And('订单支付结果中的取票码是 null', () => {
      const { mopTicketBody } = featureContext;
      expect(mopTicketBody!.fetchCode).toBeNull();
    });

    And('订单支付结果中的取票二维码是 null', () => {
      const { mopTicketBody } = featureContext;
      expect(mopTicketBody!.fetchQrCode).toBeNull();
    });

    And('订单支付结果中有 {int} 个订单项', (_ctx, itemCount: number) => {
      const { mopTicketBody } = featureContext;
      expect(mopTicketBody!.ticketInfo).toHaveLength(itemCount);
    });

    And('订单支付结果中的第 {int} 个订单项的猫眼 ID 是 {string}', (_ctx, index: number, myTicketId: string) => {
      const { mopTicketBody } = featureContext;
      expect(mopTicketBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1].myTicketId).toBe(myTicketId);
    });

    And('订单支付结果中的第 {int} 个订单项的渠道票 ID 是 {string} 的 ID', (_ctx, index: number, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      const { mopTicketBody } = featureContext;
      expect(mopTicketBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1].channelTicketId).toBe(ticket.id);
    });

    And('订单支付结果中的第 {int} 个订单项的检票码是 cr7 的订单的核销码', (_ctx, index: number) => {
      const { mopTicketBody, orderRedemption } = featureContext;
      expect(orderRedemption).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1].checkCode).toBe(orderRedemption!.code);
    });

    And('订单支付结果中的第 {int} 个订单项的检票二维码是 cr7 的订单的核销码', (_ctx, index: number) => {
      const { mopTicketBody, orderRedemption } = featureContext;
      expect(orderRedemption).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1].checkQrCode).toBe(orderRedemption!.code);
    });

    Then('订单同步记录里有 {int} 条记录', (_ctx, count: number) => {
      const { records } = featureContext;
      expect(records).toHaveLength(count);
    });

    When('猫眼再次把相同的订单支付结果同步给 cr7', async () => {
      const { apiServer, mopTicketDraft } = featureContext;
      featureContext.mopTicketEnvelope = await sendMopTicketConfirmation(apiServer, mopTicketDraft!);
    });

    Then('cr7 再次收到订单支付结果同步消息，可以正常验证签名，解密无误', async () => {
      const { mopTicketEnvelope } = featureContext;
      await verifyMopResponseSign('/mop/ticket', mopTicketEnvelope!);
      featureContext.mopTicketBody = await parseMopEncryptedResponse<MopTicketConfirmationResponse>(
        mopTicketEnvelope!
      );
    });

    And('cr7 订单状态为已付款，付款时间没有变化', async () => {
      const { apiServer, adminToken, order } = featureContext;
      const currentOrder = await getOrderAdmin(apiServer, order!.id, adminToken!);
      expect(currentOrder.status).toBe('PAID');
      expect(currentOrder.paid_at).toBe(order!.paid_at);
    });

    And('cr7 订单的核销码的创建时间没有变化', async () => {
      const { broker, order, orderRedemption } = featureContext;
      const currentRedemption = await broker.call<
        Redeem.RedemptionCodeWithOrder, { oid: string }
      >(
        'cr7.redemption.getByOrder',
        { oid: order!.id },
        { meta: { user: { uid: order!.user_id } } },
      );
      expect(new Date(currentRedemption.created_at).getTime()).toBe(new Date(orderRedemption!.created_at).getTime());
    });

    And('订单支付结果中的第 {int} 个订单项的检票码仍然是 cr7 订单的核销码', (_ctx, index: number) => {
      const { mopTicketBody, orderRedemption } = featureContext;
      expect(orderRedemption).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1]).toBeTruthy();
      expect(mopTicketBody!.ticketInfo[index - 1].checkCode).toBe(orderRedemption!.code);
    });

  });

  Scenario('用户在核销了订单之后，通知猫眼', (s: StepTest<void>) => {
    const { When, Then, And } = s;

    When('用户核销了订单', async () => {
      const { apiServer, adminToken, exhibition, orderRedemption } = featureContext;
      await redeemCode(apiServer, exhibition.id, orderRedemption!.code, adminToken!);
    });

    Then('cr7 通知猫眼订单 {string} 已经核销', (_ctx, myOrderId: string) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      expect(request.uri).toBe('/supply/open/mop/consume');
      expect(request.body).toMatchObject({ myOrderId });
    });

    Then('cr7 核销码状态变成已核销', async () => {
      const { broker, order } = featureContext;
      const redemption = await broker.call<
        Redeem.RedemptionCodeWithOrder, { oid: string }
      >(
        'cr7.redemption.getByOrder',
        { oid: order!.id },
        { meta: { user: { uid: order!.user_id } } },
      );
      expect(redemption.status).toBe('REDEEMED');
    });

  });

  Scenario('用户在猫眼取消了订单', (s: StepTest<void>) => {
    const { When, Then, And } = s;

    When('猫眼再次把相同的订单取消信息同步给 cr7', async () => {
      const { apiServer, mopOrderStatusChangeDraft } = featureContext;
      featureContext.mopOrderStatusChangeEnvelope = await sendMopOrderStatusChange(
        apiServer,
        mopOrderStatusChangeDraft!,
      );
    });

    Then('cr7 再次收到订单取消同步消息，可以正常验证签名，解密无误', async () => {
      const { mopOrderStatusChangeEnvelope } = featureContext;
      await verifyMopResponseSign('/mop/orderStatusChange', mopOrderStatusChangeEnvelope!);
      expect(mopOrderStatusChangeEnvelope!.code).toBe(10000);
      expect(mopOrderStatusChangeEnvelope!.encryptData).toBeNull();
    });

    And('cr7 订单状态为已取消，订单状态没有变化', async () => {
      const { apiServer, adminToken, order } = featureContext;
      const cancelledOrder = await getOrderAdmin(apiServer, order!.id, adminToken!);
      expect(cancelledOrder.status).toBe('CANCELLED');
      expect(cancelledOrder.cancelled_at).toBe(order!.cancelled_at);
    });

  });

  Scenario('用户在猫眼对订单申请了退款', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    And('订单退款结果中的 encrypt data 为 null', () => {
      expect(featureContext.mopOrderStatusChangeEnvelope!.encryptData).toBeNull();
    });

    And('订单详情中的退款状态为已退款，值为 {int}', (_ctx, status: number) => {
      expect(featureContext.mopOrderQueryBody!.orderRefundStatus).toBe(status);
    });

    Given('猫眼再次把相同的订单退款信息同步给 cr7', async () => {
      const { apiServer, mopOrderStatusChangeDraft } = featureContext;
      featureContext.mopOrderStatusChangeEnvelope = await sendMopOrderStatusChange(
        apiServer,
        mopOrderStatusChangeDraft!,
      );
    });

    When('cr7 再次收到订单退款同步消息，可以正常验证签名，解密无误', async () => {
      const { mopOrderStatusChangeEnvelope } = featureContext;
      await verifyMopResponseSign('/mop/orderStatusChange', mopOrderStatusChangeEnvelope!);
    });

    Then('cr7 再次返回了订单退款结果，订单退款结果中的 encrypt data 为 null', () => {
      const { mopOrderStatusChangeEnvelope } = featureContext;
      expect(mopOrderStatusChangeEnvelope).toHaveProperty('code');
      expect(mopOrderStatusChangeEnvelope!.code).toBe(10000);
      expect(mopOrderStatusChangeEnvelope!.encryptData).toBeNull();
    });

    And('cr7 订单状态为已退款，订单状态没有变化，退款时间没有变化', async () => {
      const { apiServer, adminToken, order } = featureContext;
      const currentOrder = await getOrderAdmin(apiServer, order!.id, adminToken!);
      expect(currentOrder.status).toBe('REFUNDED');
      expect(currentOrder.updated_at).toBe(order!.updated_at);
    });
  });
});
