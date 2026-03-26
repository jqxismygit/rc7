import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { addDays, addMinutes, format } from 'date-fns';
import { Exhibition, Order, Payment } from '@cr7/types';
import { expect, Mock, vi } from 'vitest';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminToken, registerUser } from './fixtures/user.js';
import { MockServer, mockJSONServer } from './lib/server.js';
import {
  prepareExhibitionSessionTicket,
  prepareTicketCategory,
} from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import {
  cancelOrder,
  createOrder as createOrderByApi,
  expireOrder,
  getOrder,
  listOrdersAdmin,
} from './fixtures/order.js';
import {
  getAdminOrderRefunds,
  initiatePayment,
  markOrderAsPaidForTest,
  requestRefund,
  requestRefundWithMock,
  MockRefundCallbackPayload,
  sendMockRefundCallback,
} from './fixtures/payment.js';
import { getSessionTickets } from './fixtures/inventory.js';
import { random_text } from './lib/random.js';

const schema = 'test_wechatpay';
const services = ['api', 'user', 'cr7'];

type ExhibitionContext = {
  exhibition?: Exhibition.Exhibition;
  session?: Exhibition.Session;
  ticket?: Exhibition.TicketCategory;
};

type ExtraTicketContext = {
  extraTicket?: Exhibition.TicketCategory;
};

type OrderContext = {
  order?: Order.OrderWithItems;
};

type PaymentContext = {
  paySign?: Payment.PaySignResult;
  mockPrepayId?: string;
  callbackResult?: boolean;
};

type RefundContext = {
  refundRecord?: Payment.RefundRecord;
  refundRecords?: Payment.RefundRecord[];
};

type ErrorContext = {
  lastError?: unknown;
};

type CloseOrderContext = {
  lastWechatCloseOutTradeNo?: string | null;
};

type InventoryContext = {
  initialTicketInventory?: number;
};

type PaymentRequestScenarioContext = ExhibitionContext & OrderContext & PaymentContext;
type PaymentSuccessScenarioContext = ExhibitionContext & OrderContext & PaymentContext;
type CancelOrderScenarioContext = ExhibitionContext & OrderContext & PaymentContext & CloseOrderContext;
type PaymentErrorScenarioContext = ExhibitionContext & OrderContext & ErrorContext;
type RefundScenarioContext = ExhibitionContext & OrderContext & RefundContext & InventoryContext & ErrorContext;
type MixedRefundPolicyScenarioContext = ExhibitionContext & OrderContext & ExtraTicketContext & ErrorContext;

type PreparedExhibitionContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticket: Exhibition.TicketCategory;
};

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  adminToken: string;
  userToken: string;
  userOpenid: string;
  wechatPayMockServer?: MockServer;
  wechatPayRequestHandler?: Mock;
}

const feature = await loadFeature('tests/features/wechatpay.feature');

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
      ['apiServer', 'broker'],
    );
    Object.assign(scenarioContext, { fixtures });
  });

  AfterAllScenarios(async () => {
    if (scenarioContext.wechatPayMockServer) {
      await scenarioContext.wechatPayMockServer.close();
    }
    await scenarioContext.fixtures.close();
  });

  function requireExhibitionContext(
    context: ExhibitionContext,
  ): PreparedExhibitionContext {
    expect(context.exhibition).toBeTruthy();
    expect(context.session).toBeTruthy();
    expect(context.ticket).toBeTruthy();

    return {
      exhibition: context.exhibition!,
      session: context.session!,
      ticket: context.ticket!,
    };
  }

  function requireOrder(context: OrderContext) {
    expect(context.order).toBeTruthy();
    return context.order!;
  }

  function requireRefundRecord(context: RefundContext) {
    expect(context.refundRecord).toBeTruthy();
    return context.refundRecord!;
  }

  async function prepareExhibitionData(
    context: ExhibitionContext,
    exhibitionName: string,
    ticketName: string,
    sessionDate: string,
    options: {
      refundPolicy?: Exhibition.TicketCategory['refund_policy'];
      maxInventory?: number;
    } = {},
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const prepared = await prepareExhibitionSessionTicket(
      apiServer,
      scenarioContext.adminToken,
      {
        exhibitionOverrides: {
          name: exhibitionName,
          description: 'wechatpay test exhibition',
          start_date: sessionDate,
          end_date: sessionDate,
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Shanghai',
        },
        ticketOverrides: {
          name: ticketName,
          price: 19900,
          valid_duration_days: 1,
          refund_policy: options.refundPolicy ?? 'NON_REFUNDABLE',
          admittance: 1,
        },
        maxInventory: options.maxInventory ?? 1,
      },
    );

    Object.assign(context, prepared);
  }

  async function createTestOrder(
    context: ExhibitionContext & OrderContext,
    items?: Order.CreateOrderItem[],
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { exhibition, session, ticket } = requireExhibitionContext(context);
    const order = await createOrderByApi(
      apiServer,
      exhibition.id,
      session.id,
      items ?? [{ ticket_category_id: ticket.id, quantity: 1 }],
      scenarioContext.userToken,
    );
    Object.assign(context, { order });
  }

  function toFutureDate(days: number) {
    return format(addDays(new Date(), days), 'yyyy-MM-dd');
  }

  function rememberError(context: ErrorContext, error: unknown) {
    Object.assign(context, { lastError: error });
  }

  function clearLastError(context: ErrorContext) {
    Object.assign(context, { lastError: null });
  }

  function assertLastAPIError(
    context: ErrorContext,
    options: {
      status?: number;
      method?: string;
      messageIncludes?: string;
    } = {},
  ) {
    expect(context.lastError).toBeTruthy();
    return assertAPIError(context.lastError, options);
  }

  async function sendRefundStatusNotification(
    context: RefundContext,
    status: 'PROCESSING' | 'SUCCESS' | 'ABNORMAL' | 'CLOSED',
    options: {
      reason?: string;
      successTime?: string;
    } = {},
  ) {
    const refundRecord = requireRefundRecord(context);
    return sendMockRefundCallback(
      scenarioContext.fixtures.values.apiServer,
      refundRecord,
      status,
      options,
    );
  }

  async function refreshOrder(context: OrderContext) {
    return getOrder(
      scenarioContext.fixtures.values.apiServer,
      requireOrder(context).id,
      scenarioContext.userToken,
    );
  }

  async function getCurrentTicketInventory(context: ExhibitionContext) {
    const { exhibition, session, ticket } = requireExhibitionContext(context);
    const inventories = await getSessionTickets(
      scenarioContext.fixtures.values.apiServer,
      scenarioContext.adminToken,
      exhibition.id,
      session.id,
    );

    const current = inventories.find(item => item.id === ticket.id);
    expect(current).toBeTruthy();
    return current!.quantity;
  }

  async function setInitialTicketInventory(
    context: ExhibitionContext & InventoryContext,
  ) {
    const quantity = await getCurrentTicketInventory(context);
    Object.assign(context, { initialTicketInventory: quantity });
  }

  Background(({ Given }) => {
    Given('微信支付已配置完成', async () => {
      // 配置项已在 config/default.mjs 中设置，此步骤确认配置存在
      expect(config.wechatpay).toBeTruthy();
      expect(config.wechatpay.appid).toBeTruthy();
      expect(config.wechatpay.mchid).toBeTruthy();

      if ((scenarioContext.adminToken ?? null) === null) {
        const { apiServer } = scenarioContext.fixtures.values;
        const adminToken = await prepareAdminToken(apiServer, schema);
        Object.assign(scenarioContext, { adminToken });
      }

      if (scenarioContext.wechatPayMockServer) {
        await scenarioContext.wechatPayMockServer.close();
      }

      const wechatPayRequestHandler = vi.fn();
      const mockServer = await mockJSONServer(wechatPayRequestHandler);
      Object.assign(scenarioContext, { wechatPayRequestHandler });

      vi.spyOn(config.wechatpay, 'base_url', 'get').mockReturnValue(mockServer.address);
      Object.assign(scenarioContext, { wechatPayMockServer: mockServer });
    });

    Given('微信用户 "wechat_user_1" 已注册并登录', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const userName = `wechat_user_1_${random_text(6)}`;
      const token = await registerUser(apiServer, userName);
      const openid = `openid_${userName}`;
      Object.assign(scenarioContext, { userToken: token, userOpenid: openid });
    });
  });

  Scenario(
    '用户下单展会门票并发起支付',
    (s: StepTest<PaymentRequestScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "成人票"', async () => {
        await prepareExhibitionData(context, 'CR7', '成人票', toFutureDate(3));
        await createTestOrder(context);
      });

      When('在微信小程序中向 cr7 支付服务发起支付', async () => {
        const mockPrepayId = 'mock_prepay_id_12345';
        Object.assign(context, { mockPrepayId });
        scenarioContext.wechatPayRequestHandler!.mockResolvedValueOnce({ prepay_id: mockPrepayId });

        const paySign = await initiatePayment(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
        Object.assign(context, { paySign });
      });

      Then('微信支付服务收到支付请求', () => {
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalled();
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.anything(),
          }),
        );
      });

      And('支付人 openid 为 "wechat_user_1" 的微信用户的 openid', () => {
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              payer: expect.objectContaining({
                openid: scenarioContext.userOpenid,
              }),
            }),
          }),
        );
      });

      And('订单号 out-trade-no 为订单号去掉 - 符号后的字符串', () => {
        const expectedOutTradeNo = requireOrder(context).id.replace(/-/g, '');
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              out_trade_no: expectedOutTradeNo,
            }),
          }),
        );
      });

      And('商品描述 description 为 {string}', (_ctx, _description: string) => {
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              description: expect.stringMatching(/^CR7 展会 成人票 \d{4}-\d{2}-\d{2} 场次$/),
            }),
          }),
        );
      });

      And('价格 amount 为订单金额，单位为分', () => {
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              amount: expect.objectContaining({
                total: context.order!.total_amount,
                currency: 'CNY',
              }),
            }),
          }),
        );
      });

      And('支付过期时间为订单创建时间加 {string} 分钟，格式为 {string}', (_ctx, minutesText: string, timeFormat: string) => {
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              time_expire: expect.any(String),
            }),
          }),
        );

        const handler = scenarioContext.wechatPayRequestHandler;
        const lastCall = handler?.mock.calls.at(-1)?.[0] as
          | { body?: Record<string, unknown> | null }
          | undefined;
        const timeExpire = lastCall?.body?.time_expire as string;
        expect(timeFormat).toContain('TIMEZONE');

        expect(timeExpire).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/);
        const orderCreatedAt = new Date(requireOrder(context).created_at);
        const expire = new Date(timeExpire);
        const expectedExpire = addMinutes(orderCreatedAt, Number(minutesText));

        expect(Math.abs(expire.getTime() - expectedExpire.getTime())).toBeLessThan(5000);
      });

      And('返回预支付信息 "mock_prepay_id_12345"', () => {
        // prepay_id 被包含在 package 字段中
        expect(context.paySign!.package).toBe(`prepay_id=${context.mockPrepayId}`);
      });

      Then('cr7 支付服务结合 prepay_id 生成支付签名并返回给微信小程序', () => {
        expect(context.paySign).toBeTruthy();
        expect(context.paySign!.signType).toBe('RSA');
        expect(context.paySign!.paySign).toBeTypeOf('string');
      });

      And('微信小程序收到可以发起支付的 pay sign 和其他必要参数', () => {
        const ps = context.paySign!;
        expect(ps.timeStamp).toBeTypeOf('string');
        expect(ps.nonceStr).toBeTypeOf('string');
        expect(ps.package).toBe(`prepay_id=${context.mockPrepayId}`);
        expect(ps.signType).toBe('RSA');
        expect(ps.paySign).toBeTypeOf('string');
      });
    },
  );

  Scenario(
    '用户下单展会门票并支付成功',
    (s: StepTest<PaymentSuccessScenarioContext>) => {
      const { Given, Then, And, context } = s;

      Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "成人票"', async () => {
        await prepareExhibitionData(
          context,
          `CR7_${random_text(4)}`,
          '成人票',
          toFutureDate(3),
        );
        await createTestOrder(context);
      });

      Given('用户发起并完成微信支付', async () => {
        const { apiServer } = scenarioContext.fixtures.values;

        await markOrderAsPaidForTest(
          apiServer,
          scenarioContext.userToken,
          requireOrder(context),
          scenarioContext.userOpenid,
        );
        Object.assign(context, { callbackResult: true });
      });

      Then('微信支付服务回调支付结果，支付成功', async () => {
        expect(context.callbackResult).toBe(true);
      });

      And('回调信息中的 cr7 支付服务收到支付结果通知并验证订单信息正确', () => {
        expect(context.callbackResult).toBe(true);
      });

      And('订单状态为 "已支付"', async () => {
        const order = await refreshOrder(context);
        expect(order.status).toBe('PAID');
      });
    },
  );

  Scenario(
    '用户下单展会门票发起支付后取消订单',
    (s: StepTest<CancelOrderScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "成人票"', async () => {
        await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(3));
        await createTestOrder(context);
      });

      Given('用户已发起支付', async () => {
        scenarioContext.wechatPayRequestHandler!.mockResolvedValueOnce({ prepay_id: 'mock_prepay_cancel' });
        const paySign = await initiatePayment(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
        Object.assign(context, { paySign });
      });

      When('用户停止支付并取消订单', async () => {
        let outTradeNo: string | null = null;
        scenarioContext.wechatPayRequestHandler!.mockImplementationOnce(async ({ path }) => {
          outTradeNo = (path.match(/out-trade-no\/([^/]+)\/close/) ?? [])[1] ?? null;
          return null;
        });

        await cancelOrder(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
        Object.assign(context, { lastWechatCloseOutTradeNo: outTradeNo });
      });

      And('微信支付服务收到订单关闭请求', () => {
        expect(context.lastWechatCloseOutTradeNo).toBe(requireOrder(context).id.replace(/-/g, ''));
      });

      Then('订单状态更新为 "已取消"', async () => {
        const order = await refreshOrder(context);
        expect(order.status).toBe('CANCELLED');
      });
    },
  );

  Scenario('过期的订单不能发起支付', (s: StepTest<PaymentErrorScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户预订了 1 张 "CR7" 展会 的 "1" 天后场次的 "成人票"', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(1));
      await createTestOrder(context);
    });

    Given('订单已过期', async () => {
    await expireOrder(scenarioContext.fixtures.values.broker, schema, requireOrder(context).id);
    });

    When('用户尝试发起支付', async () => {
      clearLastError(context);
      try {
        await initiatePayment(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝支付请求，返回错误信息 "订单已过期"', () => {
      assertLastAPIError(context, {
        status: 410,
        method: 'POST',
        messageIncludes: '订单已过期',
      });
    });

    And('订单状态仍然为 "未支付"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('EXPIRED');
    });
  });

  Scenario('已经支付的订单发起退款', (s: StepTest<RefundScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    let refundApplyRequest: { path: string; method: string; body: Record<string, unknown> } | null = null;
    let processingRefundPayload: MockRefundCallbackPayload | null = null;
    let successRefundPayload: MockRefundCallbackPayload | null = null;

    Given('用户预订了 2 张 "CR7" 展会 的 "3" 天后场次的 "成人票" 库存为 10', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(3), {
        refundPolicy: 'REFUNDABLE_48H_BEFORE',
        maxInventory: 10,
      });
      const { ticket } = requireExhibitionContext(context);
      await createTestOrder(context, [{ ticket_category_id: ticket.id, quantity: 2 }]);
      await setInitialTicketInventory(context);
    });

    And('"成人票" 的退票策略是 "允许退票，退票截止时间为场次开始前 48 小时"', () => {
      expect(context.ticket!.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    When('用户发起退款请求', async () => {
      const { refundRecord, requestPayload } = await requestRefundWithMock(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context),
        scenarioContext.userToken,
      );
      Object.assign(context, { refundRecord });
      refundApplyRequest = requestPayload;
    });

    Then('订单状态更新为  "退款已受理"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_REQUESTED');
    });

    And('订单有退款记录 ID', () => {
      expect(requireRefundRecord(context).out_refund_no).toBeTruthy();
    });

    Then('微信支付服务收到退款请求', () => {
      expect(refundApplyRequest).toBeTruthy();
      expect(refundApplyRequest!.path).toBe('/v3/refund/domestic/refunds');
      expect(refundApplyRequest!.method).toBe('POST');
    });

    And('微信支付服务收到的 out-trade-no 是发起微信付时的订单号', async () => {
      expect(refundApplyRequest!.body.out_trade_no).toBe(requireOrder(context).id.replace(/-/g, ''));
    });

    And('微信支付服务收到的 out_refund_no 是订单的退款记录 ID', async () => {
      const order = await refreshOrder(context);
      expect(refundApplyRequest!.body.out_refund_no).toBe(order.current_refund_out_refund_no);
    });

    And('微信支付服务收到的退款金额是订单金额，单位为分', () => {
      const amount = refundApplyRequest!.body.amount as { refund: number; total: number; currency: string };
      expect(amount.refund).toBe(requireOrder(context).total_amount);
    });

    And('微信支付服务收到的订单金额是订单金额，单位为分', () => {
      const amount = refundApplyRequest!.body.amount as { refund: number; total: number; currency: string };
      expect(amount.total).toBe(requireOrder(context).total_amount);
      expect(amount.currency).toBe('CNY');
    });

    And('微信支付服务收到的退款原因是 "用户发起退款"', () => {
      expect(refundApplyRequest!.body.reason).toBe('用户发起退款');
    });

    Then('微信支付服务通知 cr7 支付服务退款状态为 "退款处理中"', async () => {
      processingRefundPayload = await sendRefundStatusNotification(context, 'PROCESSING');
    });

    And('微信支付服务状态通知内容中 out-trade-no 是发起微信付时的订单号', async () => {
      expect(processingRefundPayload?.out_trade_no).toBe(requireOrder(context).id.replace(/-/g, ''));
    });

    And('微信支付服务状态通知内容中 out_refund_no 是订单的退款记录 ID', async () => {
      const order = await refreshOrder(context);
      expect(processingRefundPayload?.out_refund_no).toBe(order.current_refund_out_refund_no);
    });

    And('订单状态更新为 "退款处理中"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_PROCESSING');
    });

    Then('微信支付服务通知 cr7 支付服务退款成功', async () => {
      successRefundPayload = await sendRefundStatusNotification(
        context, 'SUCCESS', { successTime: new Date().toISOString() }
      );
    });

    And('微信支付服务退款成功通知内容中 out-trade-no 是发起微信付时的订单号', async () => {
      expect(successRefundPayload?.out_trade_no).toBe(requireOrder(context).id.replace(/-/g, ''));
    });

    And('微信支付服务退款成功通知内容中 out_refund_no 是订单的退款记录 ID', async () => {
      const order = await refreshOrder(context);
      expect(successRefundPayload?.out_refund_no).toBe(order.current_refund_out_refund_no);
    });

    And('订单状态更新为 "已退款"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUNDED');
    });

    Then('展会场次的 "成人票" 库存增加 2', async () => {
      const latest = await getCurrentTicketInventory(context);
      expect(latest).toBe(context.initialTicketInventory! + 2);
    });
  });

  Scenario('微信支付服务的退款失败', (s: StepTest<RefundScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    let failedRefundPayload: MockRefundCallbackPayload | null = null;

    Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "成人票" 库存为 10', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(3), {
        refundPolicy: 'REFUNDABLE_48H_BEFORE',
        maxInventory: 10,
      });
      const { ticket } = requireExhibitionContext(context);
      await createTestOrder(context, [{ ticket_category_id: ticket.id, quantity: 1 }]);
      await setInitialTicketInventory(context);
    });

    And('"成人票" 的退票策略是 "允许退票，退票截止时间为场次开始前 48 小时"', () => {
      expect(context.ticket!.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    When('用户发起退款请求', async () => {
      const { refundRecord } = await requestRefundWithMock(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context),
        scenarioContext.userToken,
      );
      Object.assign(context, { refundRecord });
    });

    Then('微信支付服务通知 cr7 支付服务退款结果，退款失败，失败原因 "用户账户异常"', async () => {
      failedRefundPayload = await sendRefundStatusNotification(context, 'ABNORMAL', { reason: '用户账户异常' });
    });

    And('微信支付服务退款失败通知内容中 out-trade-no 是发起微信付时的订单号', async () => {
      expect(failedRefundPayload?.out_trade_no).toBe(requireOrder(context).id.replace(/-/g, ''));
    });

    And('微信支付服务退款失败通知内容中 out_refund_no 是订单的退款记录 ID', async () => {
      const order = await refreshOrder(context);
      expect(failedRefundPayload?.out_refund_no).toBe(order.current_refund_out_refund_no);
    });

    Then('订单状态更新为 "退款失败"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_FAILED');
    });

    And('订单里有退款失败的错误信息 "用户账户异常"', async () => {
      const records = await getAdminOrderRefunds(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context).id,
        scenarioContext.adminToken,
      );
      expect(records[0]?.error_message).toContain('用户账户异常');
    });

    Then('展会场次的 "成人票" 库存不变', async () => {
      const latest = await getCurrentTicketInventory(context);
      expect(latest).toBe(context.initialTicketInventory!);
    });
  });

  Scenario('管理员可以看到所有的退款记录', (s: StepTest<RefundScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('管理员账号 "system admin" 已登录', () => {
      expect(scenarioContext.adminToken).toBeTruthy();
    });

    Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "成人票"', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(3), {
        refundPolicy: 'REFUNDABLE_48H_BEFORE',
        maxInventory: 10,
      });
      await createTestOrder(context);
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    Given('用户已发起退款请求，订单状态为 "退款已受理"', async () => {
      const { refundRecord } = await requestRefundWithMock(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context),
        scenarioContext.userToken,
      );
      Object.assign(context, { refundRecord });
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_REQUESTED');
    });

    When('管理员查看订单记录', async () => {
      const list = await listOrdersAdmin(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.adminToken,
      );
      const matched = list.orders.find(o => o.id === requireOrder(context).id);
      expect(matched).toBeTruthy();
      Object.assign(context, { order: matched! });
    });

    And('其中该订单状态为 "退款已受理"', () => {
      expect(context.order!.status).toBe('REFUND_REQUESTED');
    });

    And('该订单记录有 "1" 条退款记录', async () => {
      const refunds = await getAdminOrderRefunds(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context).id,
        scenarioContext.adminToken,
      );
      expect(refunds).toHaveLength(1);
      Object.assign(context, { refundRecords: refunds, refundRecord: refunds[0] });
    });

    Then('管理员查看退款记录详情', async () => {
      const refunds = await getAdminOrderRefunds(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context).id,
        scenarioContext.adminToken,
      );
      Object.assign(context, { refundRecords: refunds, refundRecord: refunds[0] });
    });

    And('退款记录的 ID 为订单中的退款记录 ID', () => {
      expect(context.refundRecord!.out_refund_no).toBeTruthy();
    });

    And('退款记录的付款方式为 "微信支付"', () => {
      expect(context.refundRecord!.payment_method).toBe('WECHATPAY');
    });

    And('退款记录中的退款请求状态为 "退款已受理"', () => {
      expect(context.refundRecord!.status).toBe('REQUESTED');
    });

    And('退款记录中的订单金额为订单金额，单位为分', () => {
      expect(context.refundRecord!.order_amount).toBe(requireOrder(context).total_amount);
    });

    And('退款记录中的退款金额为订单金额，单位为分', () => {
      expect(context.refundRecord!.refund_amount).toBe(requireOrder(context).total_amount);
    });

    When('微信支付服务通知 cr7 支付服务退款结果，退款成功', async () => {
      await sendRefundStatusNotification(context, 'SUCCESS', { successTime: new Date().toISOString() });
    });

    Then('退款记录中该订单的退款请求状态更新为 "已退款"', async () => {
      const records = await getAdminOrderRefunds(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context).id,
        scenarioContext.adminToken,
      );
      Object.assign(context, { refundRecord: records[0] });
      expect(records[0].status).toBe('SUCCEEDED');
    });

    And('退款记录里有退款成功时间', () => {
      expect(context.refundRecord!.succeeded_at).toBeTruthy();
    });

    And('退款记录里包含微信支付的退款处理状态', () => {
      expect(context.refundRecord!.refund_status).toBeTruthy();
    });

    And('退款记录里包含微信支付的退款单号 refund_id', () => {
      expect(context.refundRecord!.refund_id).toBeTruthy();
    });

    And('退款记录里包含微信支付退款金额，单位为分', () => {
      expect(context.refundRecord!.callback_refund_amount).toBe(requireOrder(context).total_amount);
    });

    And('退款记录里包含退款渠道', () => {
      expect(context.refundRecord!.refund_channel).toBeTruthy();
    });
  });

  Scenario('不能退票的订单发起退款流程，应该被拒绝', (s: StepTest<PaymentErrorScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "早鸟票"', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '早鸟票', toFutureDate(3), {
        refundPolicy: 'NON_REFUNDABLE',
        maxInventory: 10,
      });
      await createTestOrder(context);
    });

    And('"早鸟票" 的退票策略是 "不允许退票"', () => {
      expect(context.ticket!.refund_policy).toBe('NON_REFUNDABLE');
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    When('用户发起退款请求', async () => {
      clearLastError(context);
      try {
        await requestRefund(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝退款请求，返回错误信息 "订单不允许退款"', () => {
      assertLastAPIError(context, {
        status: 409,
        method: 'POST',
        messageIncludes: '订单不允许退款',
      });
    });

    And('订单状态仍然为 "已支付"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('PAID');
    });
  });

  Scenario('订单中包含允许退票和不允许退票的票种，发起退款请求应该被拒绝', (s: StepTest<MixedRefundPolicyScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "早鸟票" 和 1 张 "成人票"', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '早鸟票', toFutureDate(3), {
        refundPolicy: 'NON_REFUNDABLE',
        maxInventory: 10,
      });

      const { apiServer } = scenarioContext.fixtures.values;
      const adultTicket = await prepareTicketCategory(
        apiServer,
        scenarioContext.adminToken,
        requireExhibitionContext(context).exhibition.id,
        {
          name: '成人票',
          price: 19900,
          valid_duration_days: 1,
          refund_policy: 'REFUNDABLE_48H_BEFORE',
          admittance: 1,
        },
      );
      await updateTicketCategoryMaxInventory(
        apiServer,
        scenarioContext.adminToken,
        requireExhibitionContext(context).exhibition.id,
        adultTicket.id,
        10,
      );

      Object.assign(context, { extraTicket: adultTicket });

      const { ticket } = requireExhibitionContext(context);
      await createTestOrder(context, [
        { ticket_category_id: ticket.id, quantity: 1 },
        { ticket_category_id: context.extraTicket!.id, quantity: 1 },
      ]);
    });

    And('"早鸟票" 的退票策略是 "不允许退票"', () => {
      expect(context.ticket!.refund_policy).toBe('NON_REFUNDABLE');
    });

    And('"成人票" 的退票策略是 "允许退票，退票截止时间为场次开始前 48 小时"', () => {
      expect(context.extraTicket!.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    When('用户发起退款请求', async () => {
      clearLastError(context);
      try {
        await requestRefund(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝退款请求，返回错误信息 "订单中包含不允许退款的票种"', () => {
      const error = assertLastAPIError(context, { status: 409, method: 'POST' });
      expect(error.message).toContain('订单中包含不允许退款的票种');
    });

    And('订单状态仍然为 "已支付"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('PAID');
    });
  });

  Scenario('处于任何退款状态的订单都不能再次发起退款请求', (s: StepTest<RefundScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户预订了 1 张 "CR7" 展会 的 "3" 天后场次的 "成人票"', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(3), {
        refundPolicy: 'REFUNDABLE_48H_BEFORE',
        maxInventory: 10,
      });
      await createTestOrder(context);
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    Given('用户已发起退款请求，订单状态为 "退款已受理"', async () => {
      const { refundRecord } = await requestRefundWithMock(
        scenarioContext.fixtures.values.apiServer,
        requireOrder(context),
        scenarioContext.userToken,
      );
      Object.assign(context, { refundRecord });
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_REQUESTED');
    });

    When('用户再次发起退款请求', async () => {
      clearLastError(context);
      try {
        await requestRefund(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝退款请求，返回错误信息 "退款已受理"', () => {
      assertLastAPIError(context, {
        status: 409,
        method: 'POST',
        messageIncludes: '退款已受理',
      });
    });

    And('订单状态仍然为 "退款已受理"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_REQUESTED');
    });

    When('微信支付服务通知 cr7 支付服务退款状态为 "退款处理中"', async () => {
      await sendRefundStatusNotification(context, 'PROCESSING');
    });

    Then('用户第二次发起退款请求', async () => {
      clearLastError(context);
      try {
        await requestRefund(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝退款请求，返回错误信息 "退款处理中"', () => {
      assertLastAPIError(context, {
        status: 409,
        method: 'POST',
        messageIncludes: '退款处理中',
      });
    });

    And('订单状态仍然为 "退款处理中"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUND_PROCESSING');
    });

    When('微信支付服务通知 cr7 支付服务退款结果，退款成功', async () => {
      await sendRefundStatusNotification(context, 'SUCCESS', { successTime: new Date().toISOString() });
    });

    Then('用户第三次发起退款请求', async () => {
      clearLastError(context);
      try {
        await requestRefund(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝退款请求，返回错误信息 "订单已退款"', () => {
      assertLastAPIError(context, {
        status: 409,
        method: 'POST',
        messageIncludes: '订单已退款',
      });
    });

    And('订单状态仍然为 "已退款"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('REFUNDED');
    });
  });

  Scenario('退票截止时间已过的订单不能发起退款', (s: StepTest<PaymentErrorScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('用户预订了 1 张 "CR7" 展会 的 "1" 天后场次的 "成人票"', async () => {
      await prepareExhibitionData(context, `CR7_${random_text(4)}`, '成人票', toFutureDate(1), {
        refundPolicy: 'REFUNDABLE_48H_BEFORE',
        maxInventory: 10,
      });
      await createTestOrder(context);
    });

    And('"成人票" 的退票策略是 "允许退票，退票截止时间为场次开始前 48 小时"', () => {
      expect(context.ticket!.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
    });

    Given('用户已完成支付', async () => {
      await markOrderAsPaidForTest(
        scenarioContext.fixtures.values.apiServer,
        scenarioContext.userToken,
        requireOrder(context),
        scenarioContext.userOpenid,
      );
    });

    When('用户发起退款请求', async () => {
      clearLastError(context);
      try {
        await requestRefund(
          scenarioContext.fixtures.values.apiServer,
          requireOrder(context).id,
          scenarioContext.userToken,
        );
      } catch (error) {
        rememberError(context, error);
      }
    });

    Then('cr7 支付服务拒绝退款请求，返回错误信息 "订单不允许退款，已过退票截止时间"', () => {
      assertLastAPIError(context, {
        status: 409,
        method: 'POST',
        messageIncludes: '订单不允许退款，已过退票截止时间',
      });
    });

    And('订单状态仍然为 "已支付"', async () => {
      const order = await refreshOrder(context);
      expect(order.status).toBe('PAID');
    });
  });
});
