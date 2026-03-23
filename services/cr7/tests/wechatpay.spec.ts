import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { addMinutes } from 'date-fns';
import { Exhibition, Order, Payment } from '@cr7/types';
import { expect, Mock, vi } from 'vitest';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminToken, registerUser } from './fixtures/user.js';
import { MockServer, mockJSONServer } from './lib/server.js';
import {
  addTicketCategory,
  createExhibition,
  getSessions,
} from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import {
  createOrder as createOrderByApi,
  cancelOrder,
} from './fixtures/order.js';
import {
  initiatePayment,
  buildCallbackNotification,
  sendWechatCallback,
  WechatTransactionResult,
} from './fixtures/payment.js';
import { random_text } from './lib/random.js';

const schema = 'test_wechatpay';
const services = ['api', 'user', 'cr7'];

type CaseContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticket: Exhibition.TicketCategory;
  order: Order.OrderWithItems;
  paySign: Payment.PaySignResult;
  mockPrepayId: string;
  lastWechatCloseRequest: unknown;
  callback_result?: boolean;
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

  async function prepareExhibitionData(
    context: Partial<CaseContext>,
    exhibitionName: string,
    ticketName: string,
    sessionDate: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { adminToken } = scenarioContext;

    const exhibition = await createExhibition(apiServer, adminToken, {
      name: exhibitionName,
      description: 'wechatpay test exhibition',
      start_date: sessionDate,
      end_date: sessionDate,
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Shanghai',
    });

    const [session] = await getSessions(apiServer, exhibition.id, adminToken);

    const ticket = await addTicketCategory(apiServer, adminToken, exhibition.id, {
      name: ticketName,
      price: 19900,
      valid_duration_days: 1,
      refund_policy: 'NON_REFUNDABLE',
      admittance: 1,
    });

    await updateTicketCategoryMaxInventory(
      apiServer,
      adminToken,
      exhibition.id,
      ticket.id,
      1,
    );

    Object.assign(context, { exhibition, session, ticket });
  }

  async function createTestOrder(context: Partial<CaseContext>) {
    const { apiServer } = scenarioContext.fixtures.values;
    const order = await createOrderByApi(
      apiServer,
      context.exhibition!.id,
      context.session!.id,
      [{ ticket_category_id: context.ticket!.id, quantity: 1 }],
      scenarioContext.userToken,
    );
    Object.assign(context, { order });
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
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, When, Then, And, context } = s;

      Given('用户预订了 1 张 "CR7" 展会 的 "2026-07-01" 场次的 "成人票"', async () => {
        await prepareExhibitionData(context, 'CR7', '成人票', '2026-07-01');
        await createTestOrder(context);
      });

      When('在微信小程序中向 cr7 支付服务发起支付', async () => {
        const mockPrepayId = 'mock_prepay_id_12345';
        Object.assign(context, { mockPrepayId });
        scenarioContext.wechatPayRequestHandler.mockResolvedValueOnce({ prepay_id: mockPrepayId });

        const paySign = await initiatePayment(
          scenarioContext.fixtures.values.apiServer,
          context.order!.id,
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
        const expectedOutTradeNo = context.order!.id.replace(/-/g, '');
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              out_trade_no: expectedOutTradeNo,
            }),
          }),
        );
      });

      And('商品描述 description 为 {string}', (ctx, description: string) => {
        expect(scenarioContext.wechatPayRequestHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({ description })
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
        const orderCreatedAt = new Date(context.order!.created_at);
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
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, Then, And, context } = s;

      Given('用户预订了 1 张 "CR7" 展会 的 "2026-07-01" 场次的 "成人票"', async () => {
        await prepareExhibitionData(
          context,
          `CR7_${random_text(4)}`,
          '成人票',
          '2026-07-01',
        );
        await createTestOrder(context);
      });

      Given('用户发起并完成微信支付', async () => {
        const mockPrepayId = 'mock_prepay_id_success';
        Object.assign(context, { mockPrepayId });
        scenarioContext.wechatPayRequestHandler.mockResolvedValueOnce({ prepay_id: mockPrepayId });

        const paySign = await initiatePayment(
          scenarioContext.fixtures.values.apiServer,
          context.order!.id,
          scenarioContext.userToken,
        );
        Object.assign(context, { paySign });
      });

      Then('微信支付服务回调支付结果，支付成功', async () => {
        const transactionResult: WechatTransactionResult = {
          transaction_id: `wxpay_txn_${random_text(8)}`,
          out_trade_no: context.order.id.replace(/-/g, ''),
          trade_state: 'SUCCESS',
          trade_state_desc: '支付成功',
          mchid: config.wechatpay.mchid,
          appid: config.wechatpay.appid,
          trade_type: 'JSAPI',
          bank_type: 'OTHERS',
          success_time: new Date().toISOString(),
          payer: { openid: scenarioContext.userOpenid },
          amount: {
            total: context.order.total_amount,
            payer_total: context.order.total_amount,
            currency: 'CNY',
            payer_currency: 'CNY',
          },
        };

        const notification = buildCallbackNotification(
          transactionResult,
          config.wechatpay.api_v3_secret,
        );

        context.callback_result = await sendWechatCallback(
          scenarioContext.fixtures.values.apiServer,
          notification,
        )
        .then(() => true, () => false);
      });

      And('回调信息中的 cr7 支付服务收到支付结果通知并验证订单信息正确', () => {
        expect(context.callback_result).toBe(true);
      });

      And('订单状态为 "已支付"', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const { createOrder: _, ...orderApis } = await import('./fixtures/order.js');
        const order = await orderApis.getOrder(
          apiServer,
          context.order!.id,
          scenarioContext.userToken,
        );
        expect(order.status).toBe('PAID');
      });
    },
  );

  Scenario.skip(
    '用户下单展会门票发起支付后取消订单',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, When, Then, And, context } = s;

      let capturedCloseOutTradeNo: string | null = null;

      Given('用户预订了 1 张 "CR7" 展会 的 "2026-07-01" 场次的 "成人票"', async () => {
        await prepareExhibitionData(
          context,
          `CR7_${random_text(4)}`,
          '成人票',
          '2026-07-01',
        );
        await createTestOrder(context);
      });

      Given('用户已发起支付', async () => {
        const mockPrepayId = 'mock_prepay_id_cancel';
        Object.assign(scenarioContext, { wechatPayMockPrepayId: mockPrepayId });
        scenarioContext.wechatPayRequestHandler?.mockResolvedValueOnce({ prepay_id: mockPrepayId });

        const paySign = await initiatePayment(
          scenarioContext.fixtures.values.apiServer,
          context.order!.id,
          scenarioContext.userToken,
        );
        Object.assign(context, { paySign });
      });

      When('用户停止支付并取消订单', async () => {
        scenarioContext.wechatPayRequestHandler?.mockImplementationOnce(async ({ path }) => {
          capturedCloseOutTradeNo = (path.match(/out-trade-no\/([^/]+)\/close/) ?? [])[1] ?? null;
          return null;
        });

        await cancelOrder(
          scenarioContext.fixtures.values.apiServer,
          context.order!.id,
          scenarioContext.userToken,
        );
      });

      And('微信支付服务收到订单关闭请求', () => {
        expect(capturedCloseOutTradeNo).toBeTruthy();
      });

      Then('订单状态更新为 "已取消"', async () => {
        const { getOrder } = await import('./fixtures/order.js');
        const order = await getOrder(
          scenarioContext.fixtures.values.apiServer,
          context.order!.id,
          scenarioContext.userToken,
        );
        expect(order.status).toBe('CANCELLED');
      });
    },
  );

  Scenario.skip('过期的订单不能发起支付', () => {
  });
});
