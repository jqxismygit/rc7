import { Server } from 'node:http';
import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
import { ServiceBroker } from 'moleculer';
import type { Mock, MockInstance } from 'vitest';
import { expect, vi } from 'vitest';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { Damai, Exhibition, Order, Payment, Redeem, User } from '@cr7/types';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { listUsers, prepareAdminToken, suUserToken } from './fixtures/user.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
  updateExhibition,
} from './fixtures/exhibition.js';
import { getOrderAdmin } from './fixtures/order.js';
import { getAdminOrderRefunds } from './fixtures/payment.js';
import { getSessionTickets, updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import {
  buildDamaiCancelOrderRequest,
  buildDamaiCreateOrderRequest,
  buildDamaiGetETicketInfoRequest,
  buildDamaiPayOrderRequest,
  buildDamaiRefundApplyRequest,
  DamaiCancelOrderRequest,
  DamaiCancelOrderResponse,
  DamaiCreateOrderBody,
  DamaiCreateOrderRequest,
  DamaiCreateOrderResponse,
  DamaiGetETicketInfoRequest,
  DamaiGetETicketInfoResponse,
  DamaiPayOrderRequest,
  DamaiPayOrderResponse,
  DamaiRefundApplyRequest,
  DamaiRefundApplyResponse,
  getDamaiOrderSyncRecords,
  syncDamaiGetETicketInfoToCr7,
  syncDamaiCancelOrderToCr7,
  syncDamaiOrderToCr7,
  syncDamaiPayOrderToCr7,
  syncDamaiRefundApplyToCr7,
  syncExhibitionToDamai,
  syncSessionsToDamai,
  syncTicketsToDamai,
} from './fixtures/damai.js';
import { getOrderRedemption, redeemCode } from './fixtures/redeem.js';
import { toDateLabel } from './lib/relative-date.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { MockServer, mockJSONServer } from './lib/server.js';
import { verifyDamaiSignature } from '@/libs/damai.js';

const schema = 'test_damai';
const services = ['api', 'user', 'cr7', 'damai'];

const feature = await loadFeature('tests/features/damai.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  ticketByName: TicketByName;
}

interface SessionSyncContext {
  syncedSessionRange: {
    start_session_date: string;
    end_session_date: string;
  };
}

interface CreateOrderContext {
  orderDraft: DamaiCreateOrderBody;
  createOrderRequest: DamaiCreateOrderRequest;
  createOrderResponse: DamaiCreateOrderResponse;
  order: Order.OrderWithItems;
  orderUser: User.Profile;
  records: Damai.DamaiOrderSyncRecord[];
}

interface PayOrderContext {
  payOrderRequest: DamaiPayOrderRequest;
  payOrderResponse: DamaiPayOrderResponse;
}

interface CancelOrderContext {
  cancelOrderRequest: DamaiCancelOrderRequest;
  cancelOrderResponse: DamaiCancelOrderResponse;
}

interface RefundApplyContext {
  refundApplyRequest: DamaiRefundApplyRequest;
  refundApplyResponse: DamaiRefundApplyResponse;
  refundRecords: Payment.RefundRecord[];
}

interface GetETicketContext {
  getETicketRequest: DamaiGetETicketInfoRequest;
  getETicketResponse: DamaiGetETicketInfoResponse;
}

interface RedeemContext {
  redemption: Redeem.RedemptionCodeWithOrder;
}

interface DamaiValidateOrderVoucher {
  aoDetailId: string;
  validateStatus: number;
  validateCount: number;
  validateTime: string;
}

interface DamaiValidateOrderPayload {
  cOrderId: string;
  vendorOrderId: string;
  validateVoucherRequestList: DamaiValidateOrderVoucher[];
  signed: {
    timestamp: string;
    signInfo: string;
  };
}

interface FeatureContext extends
  ExhibitionContext,
  Partial<SessionSyncContext>,
  Partial<CreateOrderContext>,
  Partial<PayOrderContext>,
  Partial<CancelOrderContext>,
  Partial<RefundApplyContext>,
  Partial<GetETicketContext>,
  Partial<RedeemContext> {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
  damaiRequestHandler?: DamaiRequestHandler;
}

interface DamaiSignedPayload {
  timeStamp: string;
  signInfo: string;
}

interface DamaiHeadPayload {
  version: string;
  msgId: string;
  apiKey: string;
  apiSecret: string;
  timestamp: string;
  signed: string;
}

interface DamaiProjectSyncPayload {
  projectInfo: {
    id: string;
    name: string;
    chooseSeatFlag: boolean;
    posters: string | null;
    introduce: string;
  };
  venueInfo: {
    id: string;
    name: string;
  };
  signed: DamaiSignedPayload;
}

interface DamaiPerform {
  id: string;
  performName: string;
  status: number;
  saleStartTime: string;
  saleEndTime: string;
  showTime: string;
  endTime: string;
  tTypeAndDMethod: Record<string, number[]>;
  ruleType: number;
}

interface DamaiPerformSyncPayload {
  projectId: string;
  performs: DamaiPerform[];
  signed: DamaiSignedPayload;
}

interface DamaiPrice {
  id: string;
  name: string;
  price: number;
  saleState: number;
}

interface DamaiPriceSyncPayload {
  projectId: string;
  performId: string;
  priceList: DamaiPrice[];
  signed: DamaiSignedPayload;
  head: DamaiHeadPayload;
}

interface DamaiMockRequest<Body = unknown> {
  body: Body;
  query: Record<string, string>;
  path: string;
  method: string;
  headers: Record<string, string>;
}

type DamaiRequestBody =
  | DamaiProjectSyncPayload
  | DamaiPerformSyncPayload
  | DamaiPriceSyncPayload
  | DamaiCreateOrderRequest
  | DamaiPayOrderRequest
  | DamaiGetETicketInfoRequest
  | DamaiValidateOrderPayload;

type DamaiRequestHandler<Body = DamaiRequestBody> = Mock<
  (request: DamaiMockRequest<Body>) => unknown
>;

function toDateValue(value: string | Date): Date {
  if (isDate(value)) {
    return value;
  }

  return parseISO(value);
}

function toDateOnlyLabel(value: string | Date): string {
  const parsed = toDateValue(value);
  return format(parsed, 'yyyy-MM-dd');
}

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

function formatDamaiSessionDateTime(sessionDate: string | Date, time: string, pattern: 'HH:mm' | 'HH:mm:ss'): string {
  const label = `${toDateOnlyLabel(sessionDate)} ${normalizeTimeLabel(time)}`;
  const parsed = parse(label, 'yyyy-MM-dd HH:mm:ss', new Date());
  return format(parsed, `yyyy-MM-dd ${pattern}`);
}

function getDamaiRequestArg<Body = DamaiRequestBody>(
  mock: DamaiRequestHandler<Body>
): DamaiMockRequest<Body> {
  expect(mock).toHaveBeenCalled();
  const [request] = mock!.mock.calls.at(-1) ?? [];
  expect(request).toBeTruthy();
  return request as DamaiMockRequest<Body>;
}

async function setupDamaiMockServer(requestHandler: DamaiRequestHandler) {
  return mockJSONServer(async (request) => {
    await requestHandler(request as DamaiMockRequest<DamaiRequestBody>);
    return { code: '0', desc: '成功' };
  });
}

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
          price: price * 100,
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

    // 同步票
    And('票种同步消息中的第 {int} 个票种的 ID 是 {string} 的 ID', (_ctx, index: number, ticketName: string) => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      const ticket = featureContext.ticketByName[ticketName];

      expect(ticket).toBeTruthy();
      expect(request.body.priceList[index - 1]).toBeTruthy();
      expect(request.body.priceList[index - 1].id).toBe(ticket.id);
    });

    And('票种同步消息中的第 {int} 个票种的名称是 {string}', (_ctx, index: number, ticketName: string) => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.priceList[index - 1]).toBeTruthy();
      expect(request.body.priceList[index - 1].name).toBe(ticketName);
    });

    And('票种同步消息中的第 {int} 个票种的价格是 {int} 分', (_ctx, index: number, priceFen: number) => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.priceList[index - 1]).toBeTruthy();
      expect(request.body.priceList[index - 1].price).toBe(priceFen);
    });

    And('票种同步消息中的第 {int} 个票种的票品状态是可售，值为 {int}', (_ctx, index: number, saleState: number) => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.priceList[index - 1]).toBeTruthy();
      expect(request.body.priceList[index - 1].saleState).toBe(saleState);
    });

    // 查询库存
    Then('默认展会活动的 {string} 在 {string} 场次的库存为 {int}', async (_ctx, ticketName: string, sessionDate: string, expectedQuantity: number) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const matchedSession = sessions.find(session => toDateOnlyLabel(session.session_date) === toDateLabel(sessionDate));
      expect(matchedSession).toBeTruthy();

      const sessionTickets = await getSessionTickets(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        matchedSession!.id,
      );
      const sessionTicket = sessionTickets.find(item => item.id === ticket.id);
      expect(sessionTicket).toBeTruthy();
      expect(sessionTicket!.quantity).toBe(expectedQuantity);
    });

    Then('默认展会活动的 {string} 在 {string} 场次的库存仍然为 {int}', async (_ctx, ticketName: string, sessionDate: string, expectedQuantity: number) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const matchedSession = sessions.find(session => toDateOnlyLabel(session.session_date) === toDateLabel(sessionDate));
      expect(matchedSession).toBeTruthy();

      const sessionTickets = await getSessionTickets(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        matchedSession!.id,
      );
      const sessionTicket = sessionTickets.find(item => item.id === ticket.id);
      expect(sessionTicket).toBeTruthy();
      expect(sessionTicket!.quantity).toBe(expectedQuantity);
    });

    //创建订单
    Given('用户在大麦创建了订单', () => {
      featureContext.orderDraft = {
        daMaiOrderId: '',
        projectId: featureContext.exhibition.id,
        performId: '',
        hasSeat: false,
        commodityInfoList: [],
        priceInfo: [],
        userInfo: {
          userId: '',
        },
        totalAmountFen: 0,
        realAmountOfFen: 0,
        expressFee: 0,
      };
    });

    And('大麦的订单中的大麦订单 ID 是 {string}', (_ctx, damaiOrderId: string) => {
      featureContext.orderDraft!.daMaiOrderId = damaiOrderId;
    });

    And('大麦的订单中的项目 ID 是默认展会活动的 ID', () => {
      featureContext.orderDraft!.projectId = featureContext.exhibition.id;
    });

    And('大麦的订单中的场次 ID 是 {string} 场次', async (_ctx, sessionDate: string) => {
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const matchedSession = sessions.find(session => toDateOnlyLabel(session.session_date) === toDateLabel(sessionDate));
      expect(matchedSession).toBeTruthy();
      featureContext.orderDraft!.performId = matchedSession!.id;
    });

    And('大麦的订单中的订单项有 {int} 个', (_ctx, count: number) => {
      const draft = featureContext.orderDraft!;
      draft.priceInfo = Array.from({ length: count }, () => ({
        priceId: '',
        num: 0,
        price: 0,
      }));
      draft.commodityInfoList = [];
    });

    And('大麦的订单中的第 {int} 个订单项 ID 是 {string} 的 ID，数量为 {int}，价格为票价，单位为分', (_ctx, index: number, ticketName: string, quantity: number) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      const draft = featureContext.orderDraft!;
      draft.priceInfo[index - 1] = {
        priceId: ticket.id,
        num: quantity,
        price: ticket.price,
      };

      for (let itemIndex = 0; itemIndex < quantity; itemIndex += 1) {
        draft.commodityInfoList.push({
          priceId: ticket.id,
          subOrderId: `${draft.daMaiOrderId || 'damai_order'}_${index}_${itemIndex + 1}`,
        });
      }
    });

    And('大麦的订单中的总金额是 {int} 分，实付金额是 {int} 分', (_ctx, totalAmount: number, payAmount: number) => {
      const draft = featureContext.orderDraft!;
      draft.totalAmountFen = totalAmount;
      draft.realAmountOfFen = payAmount;
    });

    And('大麦的订单中的买家大麦 ID 是 {string}', (_ctx, buyerDamaiId: string) => {
      featureContext.orderDraft!.userInfo.userId = buyerDamaiId;
    });

    When('大麦将订单同步消息发送给 cr7', async () => {
      const request = buildDamaiCreateOrderRequest(featureContext.orderDraft!);
      featureContext.createOrderRequest = request;
      featureContext.createOrderResponse = await syncDamaiOrderToCr7(
        featureContext.apiServer,
        request,
      );
    });

    Then('cr7 收到订单同步消息，可以正常验证签名', () => {
      const request = featureContext.createOrderRequest;
      expect(request).toBeTruthy();
      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.createOrderResponse?.head.returnCode).toBe('0');
    });

    And('cr7 创建了一个订单，来源为 {string}, 状态为待支付', async (_ctx, source: string) => {
      const response = featureContext.createOrderResponse;
      expect(response).toBeTruthy();
      expect(response!.body.orderInfo.orderId).toBeTruthy();

      const order = await getOrderAdmin(
        featureContext.apiServer,
        response!.body.orderInfo.orderId!,
        featureContext.adminToken,
      );
      expect(order.source).toBe(source);
      expect(order.status).toBe('PENDING_PAYMENT');
      featureContext.order = order;
    });

    // 订单同步记录
    When('管理员第 {int} 次查看大麦订单同步记录', async () => {
      const { apiServer, adminToken, order } = featureContext;
      featureContext.records = await getDamaiOrderSyncRecords(apiServer, adminToken, order!.id);
    });

    Then('订单同步记录里有 {int} 条记录', (_ctx, count: number) => {
      const { records } = featureContext;
      expect(records).toHaveLength(count);
    });

    And('第 {int} 次查看时，最新的订单同步记录中 request path 是 {string}, 状态为成功', (_ctx, _checkIndex: number, requestPath: string) => {
      const { records } = featureContext;
      expect(records![0].request_path).toBe(requestPath);
      expect(records![0].sync_status).toBe('SUCCESS');
    });

    And('第 {int} 次查看时，最新的订单同步记录里的订单 ID 是 cr7 创建的订单 ID', (_ctx, _checkIndex: number) => {
      const { records, order } = featureContext;
      expect(records![0].order_id).toBe(order!.id);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的用户 ID 是 cr7 创建的订单关联的用户 ID', (_ctx, _checkIndex: number) => {
      const { records, order } = featureContext;
      expect(records![0].user_id).toBe(order!.user_id);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的请求体为大麦订单同步的请求体', (_ctx, _checkIndex: number) => {
      const { records, createOrderRequest } = featureContext;
      expect(records![0].request_body).toEqual(createOrderRequest);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的响应体为 cr7 返回给大麦的订单同步结果', (_ctx, _checkIndex: number) => {
      const { records, createOrderResponse } = featureContext;
      expect(records![0].response_body).toEqual(createOrderResponse);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的请求体为大麦订单支付消息的请求体', (_ctx, _checkIndex: number) => {
      const { records, payOrderRequest } = featureContext;
      expect(records![0].request_body).toEqual(payOrderRequest);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的响应体为 cr7 返回给大麦的订单支付结果', (_ctx, _checkIndex: number) => {
      const { records, payOrderResponse } = featureContext;
      expect(records![0].response_body).toEqual(payOrderResponse);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的请求体为大麦订单取消消息的请求体', (_ctx, _checkIndex: number) => {
      const { records, cancelOrderRequest } = featureContext;
      expect(records![0].request_body).toEqual(cancelOrderRequest);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的响应体为 cr7 返回给大麦的订单取消结果', (_ctx, _checkIndex: number) => {
      const { records, cancelOrderResponse } = featureContext;
      expect(records![0].response_body).toEqual(cancelOrderResponse);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的请求体为大麦订单退款申请消息的请求体', (_ctx, _checkIndex: number) => {
      const { records, refundApplyRequest } = featureContext;
      expect(records![0].request_body).toEqual(refundApplyRequest);
    });

    And('第 {int} 次查看时，最新的订单同步记录里的响应体为 cr7 返回给大麦的订单退款申请结果', (_ctx, _checkIndex: number) => {
      const { records, refundApplyResponse } = featureContext;
      expect(records![0].response_body).toEqual(refundApplyResponse);
    });

    // 支付
    Given('用户在大麦支付了订单 {string}', (_ctx, damaiOrderId: string) => {
      featureContext.payOrderRequest = buildDamaiPayOrderRequest({
        daMaiOrderId: damaiOrderId,
      });
    });

    When('cr7 收到订单支付成功的消息，可以正常验证签名', async () => {
      const request = featureContext.payOrderRequest;
      expect(request).toBeTruthy();

      featureContext.payOrderResponse = await syncDamaiPayOrderToCr7(
        featureContext.apiServer,
        request!,
      );

      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.payOrderResponse?.head.returnCode).toBe('0');
    });

    Then('cr7 将订单状态更新为已支付', async () => {
      expect(featureContext.order).toBeTruthy();
      const order = await getOrderAdmin(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.adminToken,
      );
      expect(order.status).toBe('PAID');
      featureContext.order = order;
    });

    // 取消
    Given('用户在大麦取消了订单', () => {
      featureContext.cancelOrderRequest = buildDamaiCancelOrderRequest({
        orderId: featureContext.order!.id,
      });
    });

    When('cr7 收到订单取消的消息，可以正常验证签名', async () => {
      const request = featureContext.cancelOrderRequest;
      expect(request).toBeTruthy();

      featureContext.cancelOrderResponse = await syncDamaiCancelOrderToCr7(
        featureContext.apiServer,
        request!,
      );

      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.cancelOrderResponse?.head.returnCode).toBe('0');
    });


    Then('cr7 将订单状态更新为已取消', async () => {
      expect(featureContext.order).toBeTruthy();
      const order = await getOrderAdmin(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.adminToken,
      );
      expect(order.status).toBe('CANCELLED');
      featureContext.order = order;
    });

    Given('用户在大麦对订单申请了退款', () => {
      featureContext.refundApplyRequest = buildDamaiRefundApplyRequest({
        daMaiOrderId: featureContext.orderDraft!.daMaiOrderId,
        orderId: featureContext.order!.id,
        refundId: 'damai_refund_id_123',
        refundReason: '不想看了',
        refundAmountFen: featureContext.orderDraft!.realAmountOfFen,
      });
    });

    When('cr7 收到订单退款申请的消息，可以正常验证签名', async () => {
      const request = featureContext.refundApplyRequest;
      expect(request).toBeTruthy();

      featureContext.refundApplyResponse = await syncDamaiRefundApplyToCr7(
        featureContext.apiServer,
        request!,
      );

      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.refundApplyResponse?.head.returnCode).toBe('0');
    });
  });

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
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
          name: `DAMAI_${Date.now()}`,
          start_date: toDateLabel(startDate),
          end_date: toDateLabel(endDate),
          city: '上海',
          venue_name: '上海展览中心',
          location: '上海',
        },
      );
      featureContext.ticketByName = {};
    });


    And('默认展会活动的开放时间为 {string}', async (_ctx, openingTime: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        adminToken,
        exhibition.id,
        { opening_time: openingTime },
      );
    });

    And('默认展会活动的闭馆时间为 {string}', async (_ctx, closingTime: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        adminToken,
        exhibition.id,
        { closing_time: closingTime },
      );
    });

    And('默认展会活动的最晚入场时间为 {string}', async (_ctx, lastEntryTime: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        adminToken,
        exhibition.id,
        { last_entry_time: lastEntryTime },
      );
    });

    And('默认展会活动的城市是 {string}', async (_ctx, cityName: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer, adminToken!,
        exhibition.id, { city: cityName },
      );
    });

    Given('大麦 OTA 服务已启动', async () => {
      const damaiRequestHandler = vi.fn();
      const mockDamaiServer = await setupDamaiMockServer(damaiRequestHandler);
      const baseUrlSpy = vi.spyOn(config.damai, 'base_url', 'get').mockReturnValue(mockDamaiServer.address);

      openedMockServers.push(mockDamaiServer);
      openedSpies.push(baseUrlSpy);
      featureContext.damaiRequestHandler = damaiRequestHandler;
    });
  });

  Scenario('同步展会信息到大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given('cr7 将展会信息同步到大麦', async () => {
      await syncExhibitionToDamai(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('大麦收到展会同步消息', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.path).toBe('/b2b2c/2.0/sync/project');
      expect(request.method).toBe('POST');
    });

    Then('大麦收到请求签名无误', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { signed } = request.body as DamaiProjectSyncPayload;

      expect(signed.timeStamp).toMatch(/\d{13}/);
      expect(signed.signInfo).toBe(config.damai.sign);
    });

    And('展会同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.id).toBe(exhibition.id);
    });

    And('展会同步消息中的项目名称是默认展会活动的名称', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.name).toBe(exhibition.name);
    });

    And('展会同步消息中的座位信息是无座', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.chooseSeatFlag).toBe(false);
    });

    And('展会同步消息中的海报 URL 是默认展会活动的封面 URL', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.posters).toBe(exhibition.cover_url ?? null);
    });

    And('展会同步消息中的介绍信息是默认展会活动的描述信息', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.introduce).toBe(exhibition.description);
    });

    And('展会同步消息中的展馆 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.venueInfo.id).toBe(exhibition.id);
    });

    And('展会同步消息中的展馆名称是默认展会活动的展馆名称', () => {
      const request = getDamaiRequestArg<DamaiProjectSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.venueInfo.name).toBe(exhibition.venue_name);
    });
  });

  Scenario('同步场次信息到大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given(
      'cr7 将场次信息同步到大麦, 同步的场次开始时间是 {string}，结束时间是 {string}',
      async (_ctx, startDate: string, endDate: string) => {
      const start_session_date = toDateLabel(startDate);
      const end_session_date = toDateLabel(endDate);
      featureContext.syncedSessionRange = {
        start_session_date,
        end_session_date,
      };

      await syncSessionsToDamai(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        featureContext.syncedSessionRange,
      );
    });

    When('大麦收到场次同步消息', () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.path).toBe('/b2b2c/2.0/sync/perform');
      expect(request.method).toBe('POST');
    });

    Then('大麦收到请求签名无误', () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const body = request.body as DamaiPerformSyncPayload;
      const { signed } = body;

      expect(signed.timeStamp).toMatch(/\d{13}/);
      expect(signed.signInfo).toBe(config.damai.sign);
    });

    And('场次同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.projectId).toBe(featureContext.exhibition.id);
    });

    And('场次同步消息中有 {int} 个场次信息', (_ctx, count: number) => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.performs).toHaveLength(count);
    });

    And('场次同步消息中每个场次的 ID 是默认展会活动对应场次的 ID', async () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);

      const expectedIds = new Set(sessions.map(session => session.id));
      for (const perform of request.body.performs) {
        expect(expectedIds.has(perform.id)).toBe(true);
      }
    });

    And('场次同步消息中的第 1 个场次的日期是 {string}', (ctx, expectedDate: string) => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const perform = request.body.performs[0];
      const { exhibition } = featureContext;
      const expectedLabel = formatDamaiSessionDateTime(
        toDateLabel(expectedDate), exhibition.opening_time, 'HH:mm'
      )
      expect(perform.showTime).toBe(expectedLabel);
    });

    And('场次同步消息中的第 2 个场次的日期是 {string}', (ctx, expectedDate: string) => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const perform = request.body.performs[1];
      const { exhibition } = featureContext;
      const expectedLabel = formatDamaiSessionDateTime(
        toDateLabel(expectedDate), exhibition.opening_time, 'HH:mm'
      )
      expect(perform.showTime).toBe(expectedLabel);
    });

    And('场次同步消息中每个场次的名称都是展会的日期', async () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const expectedBySessionId = new Map(
        sessions.map(session => [session.id, format(toDateValue(session.session_date), 'yyyy-MM-dd')]),
      );

      request.body.performs.forEach(perform => {
        expect(perform.performName).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的销售开始时间都是展会创建时间，格式为 {string}', (_ctx, expectedFormat: string) => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const { exhibition } = featureContext;
      const expected = format(toDateValue(exhibition.created_at), expectedFormat);

      request.body.performs.forEach(perform => {
        expect(perform.saleStartTime).toBe(expected);
      });
    });

    And('场次同步消息中每个场次的销售结束时间是场次日期的最晚入场时间', async () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          formatDamaiSessionDateTime(session.session_date, exhibition.last_entry_time, 'HH:mm'),
        ]),
      );

      request.body.performs.forEach(perform => {
        expect(perform.saleEndTime).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的场次演出开始时间是展会场次日期的场次开始时间', async () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          formatDamaiSessionDateTime(session.session_date, exhibition.opening_time, 'HH:mm'),
        ]),
      );

      request.body.performs.forEach(perform => {
        expect(perform.showTime).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的场次演出结束时间是展会场次日期的结束时间', async () => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);

      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          formatDamaiSessionDateTime(session.session_date, exhibition.closing_time, 'HH:mm'),
        ]),
      );

      request.body.performs.forEach(perform => {
        expect(perform.endTime).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的场次的取票方式是电子票，值为 {int}', (_ctx, ticketType: number) => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);

      request.body.performs.forEach(perform => {
        expect(perform.tTypeAndDMethod[String(ticketType)]).toEqual([ticketType]);
      });
    });

    And('场次的同步消息中每个场次的认证方式都是非实名制，值为 {int}', (_ctx, ruleType: number) => {
      const request = getDamaiRequestArg<DamaiPerformSyncPayload>(featureContext.damaiRequestHandler!);

      request.body.performs.forEach(perform => {
        expect(perform.ruleType).toBe(ruleType);
      });
    });
  });

  Scenario('同步票种信息到大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given(
      'cr7 将票种信息同步到大麦, 同步的是 {string} 场次',
      async (_ctx, sessionDate: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const targetDate = toDateLabel(sessionDate);
      const session = sessions.find(item => toDateOnlyLabel(item.session_date) === targetDate);
      expect(session).toBeTruthy();

      await syncTicketsToDamai(
        apiServer,
        adminToken,
        exhibition.id,
        session!.id,
      );
    });

    When('大麦收到票种同步消息', () => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.path).toBe('/b2b2c/2.0/sync/price');
      expect(request.method).toBe('POST');
    });

    Then('大麦收到请求签名无误', () => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      const body = request.body as DamaiPriceSyncPayload;
      const { signed } = body;
      expect(signed.timeStamp).toMatch(/\d{13}/);
      expect(signed.signInfo).toBe(config.damai.sign);
    });

    And('票种同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.projectId).toBe(featureContext.exhibition.id);
    });

    And('票种同步消息中的场次 ID 是 {string} 场次的 ID', async (_ctx, sessionDate: string) => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const targetDate = toDateLabel(sessionDate);
      const session = sessions.find(item => toDateOnlyLabel(item.session_date) === targetDate);

      expect(session).toBeTruthy();
      expect(request.body.performId).toBe(session?.id);
    });

    And('票种同步消息中有 {int} 个票种信息', (_ctx, count: number) => {
      const request = getDamaiRequestArg<DamaiPriceSyncPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.priceList).toHaveLength(count);
    });
  });

  Scenario('用户通过大麦 OTA 创建订单', (s: StepTest<void>) => {
    const { When, Then, And } = s;

    And('订单的订单项有 {int} 个', (_ctx, count: number) => {
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.order!.items).toHaveLength(count);
    });

    And('订单的第 {int} 个订单项是 {string}，数量为 {int}，价格为票价，单位为元', (_ctx, index: number, ticketName: string, quantity: number) => {
      const order = featureContext.order;
      expect(order).toBeTruthy();
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      const item = order!.items.find(current => current.ticket_category_id === ticket.id);
      expect(item).toBeTruthy();
      expect(item!.quantity).toBe(quantity);
      expect(item!.unit_price).toBe(ticket.price);
    });

    And('订单的第 2 个订单项是 {string}，数量为 {int}，价格为票价，单位为元', (_ctx, ticketName: string, quantity: number) => {
      const order = featureContext.order;
      expect(order).toBeTruthy();
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      const item = order!.items.find(current => current.ticket_category_id === ticket.id);
      expect(item).toBeTruthy();
      expect(item!.quantity).toBe(quantity);
      expect(item!.unit_price).toBe(ticket.price);
    });

    Then('cr7 创建了一个用户，其关联的大麦 ID 是 {string}, 手机号为空，姓名是 {string}', async (_ctx, damaiId: string, expectedName: string) => {
      const { apiServer, adminToken } = featureContext;
      const { users: [user] } = await listUsers(
        apiServer, adminToken, { damai_user_id: damaiId }
      );
      expect(user).toBeTruthy();
      expect(user!.damai_user_id).toBe(damaiId);
      expect(user!.phone ?? null).toBeNull();
      expect(user!.name).toBe(expectedName);
      featureContext.orderUser = user!;
    });

    Then('cr7 给大麦返回了订单同步结果', () => {
      const response = featureContext.createOrderResponse;
      expect(response).toBeTruthy();
      expect(response).toHaveProperty('head.returnCode', '0');
      expect(response).toHaveProperty('head.returnDesc', '成功');
    });

    And('订单同步结果里的订单 ID 是 cr7 创建的订单 ID', () => {
      expect(featureContext.createOrderResponse).toBeTruthy();
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.createOrderResponse!.body.orderInfo.orderId).toBe(featureContext.order!.id);
    });

    And('订单同步结果里的订单总金额是 {int} 分，实付金额是 {int} 分', (_ctx, totalAmount: number, payAmount: number) => {
      expect(featureContext.createOrderResponse).toBeTruthy();
      expect(featureContext.createOrderResponse!.body.orderInfo.totalAmount).toBe(totalAmount);
      expect(featureContext.createOrderResponse!.body.orderInfo.realAmount).toBe(payAmount);
    });

    When('大麦再次把相同的订单同步消息发送给 cr7', async () => {
      featureContext.createOrderResponse = await syncDamaiOrderToCr7(
        featureContext.apiServer,
        featureContext.createOrderRequest!,
      );
    });

    Then('cr7 再次收到订单同步消息，可以正常验证签名', () => {
      const request = featureContext.createOrderRequest;
      expect(request).toBeTruthy();
      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.createOrderResponse?.head.returnCode).toBe('0');
    });

    And('cr7 给大麦返回了订单同步结果，订单 ID 是之前创建的订单 ID，订单总金额是 {int} 分，实付金额是 {int} 分', (_ctx, totalAmount: number, payAmount: number) => {
      expect(featureContext.createOrderResponse).toBeTruthy();
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.createOrderResponse!.body.orderInfo.orderId).toBe(featureContext.order!.id);
      expect(featureContext.createOrderResponse!.body.orderInfo.totalAmount).toBe(totalAmount);
      expect(featureContext.createOrderResponse!.body.orderInfo.realAmount).toBe(payAmount);
    });
  });

  Scenario('用户在大麦支付了订单', (s: StepTest<void>) => {
    const { When, Then, And } = s;

    And('cr7 返回了大麦订单支付结果', () => {
      const response = featureContext.payOrderResponse;
      expect(response).toBeTruthy();
      expect(response).toHaveProperty('head.returnCode', '0');
      expect(response).toHaveProperty('head.returnDesc', '成功');
    });

    And('订单支付结果里的第三方订单 ID 是 cr7 创建的订单 ID', () => {
      expect(featureContext.payOrderResponse).toBeTruthy();
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.payOrderResponse!.body.orderPayInfo.thirdOrderId).toBe(featureContext.order!.id);
    });

    And('订单支付结果里的大麦订单 ID 是 {string}', (_ctx, damaiOrderId: string) => {
      expect(featureContext.payOrderResponse).toBeTruthy();
      expect(featureContext.payOrderResponse!.body.orderPayInfo.daMaiOrderId).toBe(damaiOrderId);
    });

    And('订单支付结果里的支付状态为成功，值为 {int}', (_ctx, expectedStatus: number) => {
      expect(featureContext.payOrderResponse).toBeTruthy();
      expect(featureContext.payOrderResponse!.body.orderPayInfo.payStatus).toBe(expectedStatus);
    });

    When('大麦再次把相同的订单支付消息发送给 cr7', async () => {
      featureContext.payOrderResponse = await syncDamaiPayOrderToCr7(
        featureContext.apiServer,
        featureContext.payOrderRequest!,
      );
    });

    Then('cr7 再次收到订单支付成功的消息，可以正常验证签名', () => {
      const request = featureContext.payOrderRequest;
      expect(request).toBeTruthy();
      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.payOrderResponse?.head.returnCode).toBe('0');
    });

    And('cr7 返回了大麦订单支付结果，订单 ID 是之前创建的订单 ID，大麦订单 ID 是 {string}，支付状态为成功，值为 {int}', (_ctx, damaiOrderId: string, expectedStatus: number) => {
      expect(featureContext.payOrderResponse).toBeTruthy();
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.payOrderResponse!.body.orderPayInfo.thirdOrderId).toBe(featureContext.order!.id);
      expect(featureContext.payOrderResponse!.body.orderPayInfo.daMaiOrderId).toBe(damaiOrderId);
      expect(featureContext.payOrderResponse!.body.orderPayInfo.payStatus).toBe(expectedStatus);
    });
  });

  Scenario('用户在大麦查询电子票信息', (s: StepTest<void>) => {
    const { When, Then, And } = s;

    When('用户在大麦查询订单的电子票信息', async () => {
      featureContext.getETicketRequest = buildDamaiGetETicketInfoRequest({
        orderId: featureContext.order!.id,
      });

      featureContext.getETicketResponse = await syncDamaiGetETicketInfoToCr7(
        featureContext.apiServer,
        featureContext.getETicketRequest,
      );
    });

    Then('大麦收到查询电子票信息的请求，可以正常验证签名', () => {
      const request = featureContext.getETicketRequest;
      expect(request).toBeTruthy();
      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.getETicketResponse?.head.returnCode).toBe('0');
    });

    And('大麦查询电子票信息的请求里的第三方订单 ID 是 cr7 创建的订单 ID', () => {
      expect(featureContext.getETicketRequest).toBeTruthy();
      expect(featureContext.getETicketRequest!.bodyGetESeatInfo.orderId).toBe(featureContext.order!.id);
    });

    Then('cr7 给大麦返回了电子票信息', () => {
      expect(featureContext.getETicketResponse).toBeTruthy();
      expect(featureContext.getETicketResponse!.head.returnCode).toBe('0');
    });

    And('电子票信息中的项目名称为默认展会活动的名称', () => {
      expect(featureContext.getETicketResponse).toBeTruthy();
      expect(featureContext.getETicketResponse!.body.bodyGetESeatInfo.projectName).toBe(featureContext.exhibition.name);
    });

    And('电子票信息中的场馆名称为默认展会活动的展馆名称', () => {
      expect(featureContext.getETicketResponse).toBeTruthy();
      expect(featureContext.getETicketResponse!.body.bodyGetESeatInfo.venueName).toBe(featureContext.exhibition.venue_name);
    });

    And('电子票信息中的演出时间为 {string} 场次的演出时间， 格式为毫秒级时间戳', async (_ctx, sessionDate: string) => {
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const matchedSession = sessions.find(session => toDateOnlyLabel(session.session_date) === toDateLabel(sessionDate));
      expect(matchedSession).toBeTruthy();

      const expectedShowTime = parse(
        `${toDateOnlyLabel(matchedSession!.session_date)} ${normalizeTimeLabel(featureContext.exhibition.opening_time)}`,
        'yyyy-MM-dd HH:mm:ss',
        new Date(),
      ).getTime();

      expect(featureContext.getETicketResponse!.body.bodyGetESeatInfo.showTime).toBe(expectedShowTime);
    });

    And('电子票信息中的电子票有 {int} 张', (_ctx, count: number) => {
      expect(featureContext.getETicketResponse).toBeTruthy();
      expect(featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos).toHaveLength(count);
    });

    And('电子票信息中的电子票的票单号为 cr7 订单 item ID，不是票种 ID', () => {
      const eticketInfos = featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos;
      const orderItemIds = new Set(featureContext.order!.items.map(item => item.id));
      const ticketCategoryIds = new Set(featureContext.order!.items.map(item => item.ticket_category_id));

      eticketInfos.forEach(ticket => {
        expect(orderItemIds.has(ticket.aoDetailId)).toBe(true);
        expect(ticketCategoryIds.has(ticket.aoDetailId)).toBe(false);
      });
    });

    And('电子票信息中的证件类型为非实名制，值为 {int}', (_ctx, certType: number) => {
      featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.forEach(ticket => {
        expect(ticket.certType).toBe(certType);
      });
    });

    And('电子票信息中的是否有座位为无座，值为 {boolean}', (_ctx, hasSeatLabel: boolean) => {
      featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.forEach(ticket => {
        expect(ticket.hasSeat).toBe(hasSeatLabel);
      });
    });

    And('电子票信息中的票价为订单 item 价格，单位为分', () => {
      const expectedPrices = featureContext.order!.items.flatMap(item => Array.from(
        { length: item.quantity },
        () => item.unit_price,
      ));
      const actualPrices = featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.map(ticket => ticket.price);
      expect(actualPrices).toEqual(expectedPrices);
    });

    And('电子票信息中的价格 ID 是票种 ID', () => {
      const expectedPriceIds = featureContext.order!.items.flatMap(item => Array.from(
        { length: item.quantity },
        () => item.ticket_category_id,
      ));
      const actualPriceIds = featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.map(ticket => ticket.priceId);
      expect(actualPriceIds).toEqual(expectedPriceIds);
    });

    And('电子票信息中的取票类型为静态二维码电子票，值为 {int}', (_ctx, qrcodeType: number) => {
      featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.forEach(ticket => {
        expect(ticket.qrcodeType).toBe(qrcodeType);
      });
    });

    And('电子票信息中的二维码为订单的核销码', async () => {
      const userToken = await suUserToken(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.order!.user_id,
      );
      const redemption = await getOrderRedemption(
        featureContext.apiServer,
        featureContext.order!.id,
        userToken,
      );

      featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.forEach(ticket => {
        expect(ticket.qrCode).toBe(redemption.code);
      });
    });

    And('电子票信息中的是否对号入座为否，值为 {boolean}', (_ctx, seatByNumberLabel: boolean) => {
      featureContext.getETicketResponse!.body.bodyGetESeatInfo.eticketInfos.forEach(ticket => {
        expect(ticket.seatByNumber).toBe(seatByNumberLabel);
      });
    });
  });

  Scenario('用户在核销了订单之后，通知大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given('用户核销了订单', async () => {
      const { apiServer, adminToken, exhibition, order } = featureContext;
      const userToken = await suUserToken(
        apiServer,
        adminToken,
        order!.user_id,
      );
      const redemption = await getOrderRedemption(
        apiServer,
        order!.id,
        userToken,
      );
      await redeemCode(apiServer, exhibition.id, redemption.code, adminToken);

      const redeemedRedemption = await getOrderRedemption(
        apiServer,
        order!.id,
        userToken,
      );
      featureContext.redemption = redeemedRedemption;
    });

    When('cr7 通知大麦订单 {string} 已核销', (_ctx, _damaiOrderId: string) => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      expect(request.path).toBe('/b2b2c/2.0/sync/validate');
      expect(request.method).toBe('POST');
    });

    Then('cr7 核销码状态更新为已核销', () => {
      expect(featureContext.redemption?.status).toBe('REDEEMED');
    });

    Then('大麦收到订单核销通知，可以正常验证签名', () => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.signed.signInfo).toBe(config.damai.sign);
    });

    And('订单核销通知里的第三方订单 ID 是 cr7 创建的订单 ID', () => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.vendorOrderId).toBe(featureContext.order!.id);
    });

    And('订单核销通知里的大麦订单 ID 是 {string}', (_ctx, damaiOrderId: string) => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.cOrderId).toBe(damaiOrderId);
    });

    And('订单核销通知里的核验票单有 {int} 张', (_ctx, count: number) => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      expect(request.body.validateVoucherRequestList).toHaveLength(count);
    });

    And('订单核销通知里的核验票单的三方票单号为 cr7 订单 item ID，不是票种 ID', () => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      const orderItemIds = new Set(featureContext.order!.items.map(item => item.id));
      const ticketCategoryIds = new Set(featureContext.order!.items.map(item => item.ticket_category_id));
      request.body.validateVoucherRequestList.forEach(voucher => {
        expect(orderItemIds.has(voucher.aoDetailId)).toBe(true);
        expect(ticketCategoryIds.has(voucher.aoDetailId)).toBe(false);
      });
    });

    And('订单核销通知里的核验票单的核销状态都为已验，值为 {int}', (_ctx, status: number) => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      request.body.validateVoucherRequestList.forEach(voucher => {
        expect(voucher.validateStatus).toBe(status);
      });
    });

    And('订单核销通知里的核验票的验票次数都为 {int}', (_ctx, count: number) => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      request.body.validateVoucherRequestList.forEach(voucher => {
        expect(voucher.validateCount).toBe(count);
      });
    });

    And('订单核销通知里的核验票单的核销时间都为核销码的核销时间，格式为 {string}', (_ctx, expectedFormat: string) => {
      const request = getDamaiRequestArg<DamaiValidateOrderPayload>(featureContext.damaiRequestHandler!);
      const expectedTime = format(toDateValue(featureContext.redemption!.redeemed_at!), expectedFormat);
      request.body.validateVoucherRequestList.forEach(voucher => {
        expect(voucher.validateTime).toBe(expectedTime);
      });
    });
  });

  Scenario('用户在大麦取消了订单', (s: StepTest<void>) => {
    const { Given, Then, And } = s;

    And('订单取消消息中的订单 ID 是 cr7 创建的订单 ID', () => {
      expect(featureContext.cancelOrderRequest).toBeTruthy();
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.cancelOrderRequest!.cancelOrderInfo.orderId).toBe(featureContext.order!.id);
    });


    And('cr7 返回了大麦订单取消结果，状态为成功，值为 {string}', (_ctx, expectedCode: string) => {
      expect(featureContext.cancelOrderResponse).toBeTruthy();
      expect(featureContext.cancelOrderResponse!.head.returnCode).toBe(expectedCode);
    });

    And('cr7 再次返回了大麦订单取消结果，状态为成功，值为 {string}', (_ctx, expectedCode: string) => {
      expect(featureContext.cancelOrderResponse).toBeTruthy();
      expect(featureContext.cancelOrderResponse!.head.returnCode).toBe(expectedCode);
    });

    Given('大麦再次把相同的订单取消消息发送给 cr7', async () => {
      featureContext.cancelOrderResponse = await syncDamaiCancelOrderToCr7(
        featureContext.apiServer,
        featureContext.cancelOrderRequest!,
      );
    });

    Then('cr7 再次收到订单取消的消息，可以正常验证签名', () => {
      const request = featureContext.cancelOrderRequest;
      expect(request).toBeTruthy();

      expect(verifyDamaiSignature(request!.head.signed, {
        apiKey: config.damai.api_key,
        apiPw: config.damai.api_pwd,
        msgId: request!.head.msgId,
        timestamp: request!.head.timestamp,
        version: request!.head.version,
      })).toBe(true);
      expect(featureContext.cancelOrderResponse?.head.returnCode).toBe('0');
    });
  });

  Scenario('用户在大麦申请了退款', (s: StepTest<void>) => {
    const { Then, And, When } = s;

    And('订单退款申请消息中的大麦订单 ID 是 {string}', (_ctx, damaiOrderId: string) => {
      expect(featureContext.refundApplyRequest!.bodyRefundApply.refundInfo.daMaiOrderId).toBe(damaiOrderId);
    });

    And('订单退款申请消息中的订单 ID 是 cr7 创建的订单 ID', () => {
      expect(featureContext.refundApplyRequest!.bodyRefundApply.refundInfo.orderId).toBe(featureContext.order!.id);
    });

    And('订单退款申请消息中的退款 ID 是 {string}', (_ctx, refundId: string) => {
      expect(featureContext.refundApplyRequest!.bodyRefundApply.refundInfo.refundId).toBe(refundId);
    });

    And('订单退款申请消息中的退款原因是 {string}', (_ctx, refundReason: string) => {
      expect(featureContext.refundApplyRequest!.bodyRefundApply.refundInfo.refundReason).toBe(refundReason);
    });

    And('订单退款申请消息中的退款金额是 {int} 分', (_ctx, refundAmountFen: number) => {
      expect(featureContext.refundApplyRequest!.bodyRefundApply.refundInfo.refundAmountFen).toBe(refundAmountFen);
    });

    Then('cr7 将订单状态更新为已退款', async () => {
      const order = await getOrderAdmin(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.adminToken,
      );
      expect(order.status).toBe('REFUNDED');
      featureContext.order = order;
    });

    Then('cr7 给大麦返回了订单退款申请结果', () => {
      const { refundApplyResponse } = featureContext;
      expect(refundApplyResponse).toBeTruthy();
      expect(refundApplyResponse!.head.returnCode).toBe('0');
      expect(refundApplyResponse!.head.returnDesc).toBe('成功');
    });

    Then('cr7 返回的订单退款结果里的退款 ID 是 cr7生成的 uuid 去掉短横线的字符串', async () => {
      const order = await getOrderAdmin(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.adminToken,
      );
      expect(order.current_refund_out_refund_no).toMatch(/^[0-9a-f]{32}$/i);
      featureContext.order = order;
    });

    When('管理员查看订单的退款记录', async () => {
      const refunds = await getAdminOrderRefunds(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.adminToken,
      );
      featureContext.refundRecords = refunds;
    });

    Then('订单的退款记录里有 {int} 条记录', (_ctx, count: number) => {
      expect(featureContext.refundRecords).toHaveLength(count);
    });

    And('退款记录里的订单 ID 是 cr7 创建的订单 ID', () => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.order_id).toBe(featureContext.order!.id);
    });

    And('退款记录里的 refound no 是 返回给大麦的订单退款申请结果里的退款 ID', () => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.out_refund_no).toBe(featureContext.order!.current_refund_out_refund_no);
    });

    And('退款记录里的 out trade no 是 {string}', (_ctx, damaiOrderId: string) => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.out_trade_no).toBe(damaiOrderId);
    });

    And('退款记录里的第三方退款 ID 是 {string}', (_ctx, refundId: string) => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.refund_id).toBe(refundId);
    });

    And('退款记录里的退款金额是 {int} 分', (_ctx, refundAmountFen: number) => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.refund_amount).toBe(refundAmountFen);
    });

    And('退款记录里的退款原因是 {string}', (_ctx, refundReason: string) => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.reason).toBe(refundReason);
    });

    And('退款记录里的退款状态是已退款', () => {
      const refundRecord = featureContext.refundRecords![0];
      expect(refundRecord.refund_status).toBe('SUCCESS');
    });
  });
});
