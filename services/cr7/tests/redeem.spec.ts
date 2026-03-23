import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { Exhibition, Order, Redeem, User } from '@cr7/types';
import { expect, vi } from 'vitest';
import type { ServiceBroker } from 'moleculer';
import type { Pool } from 'pg';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminToken, registerUser, getUserProfile } from './fixtures/user.js';
import {
  addTicketCategory,
  createExhibition,
  getSessions,
} from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { createOrder as createOrderByApi } from './fixtures/order.js';
import {
  getOrderRedemption,
  isValidRedemptionCodeLuhn,
  redeemCode,
  toSessionDateLabel,
} from './fixtures/redeem.js';
import { grantRoleToUser as grantRoleToUserAPI } from './fixtures/user.js';
import {
  buildCallbackNotification,
  initiatePayment,
  sendWechatCallback,
  WechatTransactionResult,
} from './fixtures/payment.js';
import { MockServer, mockJSONServer } from './lib/server.js';

const schema = 'test_redeem';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/redeem.feature');

type CaseContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticket: Exhibition.TicketCategory;
  order: Order.OrderWithItems;
  redemption: Redeem.RedemptionCodeWithOrder;
  lastError: unknown;
};

type RoleName = 'ADMIN' | 'OPERATOR';

type ServiceWithPool = {
  pool: Pick<Pool, 'query'>;
};

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  adminToken: string;
  adminProfile: User.Profile;
  userToken: string;
  operatorToken?: string;
  operatorProfile?: User.Profile;
  usersByName: Record<string, { token: string; profile: User.Profile }>;
  wechatPayMockServer?: MockServer;
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
      ['apiServer', 'broker'],
    );

    const wechatPayMockServer = await mockJSONServer(async () => ({
      prepay_id: `mock_prepay_${Date.now()}`,
    }));

    vi.spyOn(config.wechatpay, 'base_url', 'get').mockReturnValue(wechatPayMockServer.address);

    Object.assign(scenarioContext, {
      fixtures,
      usersByName: {},
      wechatPayMockServer,
    });
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
    sessionDateInput: string,
    ticketName: string,
    admittance: number,
    inventory: number,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const sessionDate = toSessionDateLabel(sessionDateInput);

    const exhibition = await createExhibition(apiServer, scenarioContext.adminToken, {
      name: `${exhibitionName}_${Date.now()}`,
      description: 'redeem test exhibition',
      start_date: sessionDate,
      end_date: sessionDate,
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Shanghai',
    });

    const [session] = await getSessions(apiServer, exhibition.id, scenarioContext.adminToken);
    const ticket = await addTicketCategory(apiServer, scenarioContext.adminToken, exhibition.id, {
      name: ticketName,
      price: 100,
      valid_duration_days: 1,
      refund_policy: 'NON_REFUNDABLE',
      admittance,
    });

    await updateTicketCategoryMaxInventory(
      apiServer,
      scenarioContext.adminToken,
      exhibition.id,
      ticket.id,
      inventory,
    );

    Object.assign(context, {
      exhibition,
      session,
      ticket,
    });
  }

  async function createOrderForCurrentUser(
    context: Partial<CaseContext>,
    quantity: number,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const order = await createOrderByApi(
      apiServer,
      context.exhibition!.id,
      context.session!.id,
      [{ ticket_category_id: context.ticket!.id, quantity }],
      scenarioContext.userToken,
    );

    Object.assign(context, { order });
  }

  async function payOrderForCurrentUser(context: Partial<CaseContext>) {
    const { apiServer } = scenarioContext.fixtures.values;
    const user = scenarioContext.usersByName.Alice;
    expect(user).toBeTruthy();
    expect(user.profile.openid).toBeTruthy();

    await initiatePayment(apiServer, context.order!.id, scenarioContext.userToken);

    const notification = buildCallbackNotification(
      {
        transaction_id: `wxpay_txn_${Date.now()}`,
        out_trade_no: context.order!.id.replace(/-/g, ''),
        trade_state: 'SUCCESS',
        trade_state_desc: '支付成功',
        mchid: config.wechatpay.mchid,
        appid: config.wechatpay.appid,
        trade_type: 'JSAPI',
        bank_type: 'OTHERS',
        success_time: new Date().toISOString(),
        payer: { openid: user.profile.openid! },
        amount: {
          total: context.order!.total_amount,
          payer_total: context.order!.total_amount,
          currency: 'CNY',
          payer_currency: 'CNY',
        },
      } satisfies WechatTransactionResult,
      config.wechatpay.api_v3_secret,
    );

    await sendWechatCallback(apiServer, notification);
  }

  async function fetchOrderRedemption(context: Partial<CaseContext>) {
    const { apiServer } = scenarioContext.fixtures.values;
    const redemption = await getOrderRedemption(apiServer, context.order!.id, scenarioContext.userToken);

    Object.assign(context, { redemption });
  }

  function rememberError(context: Partial<CaseContext>, error: unknown) {
    Object.assign(context, { lastError: error });
  }

  function clearLastError(context: Partial<CaseContext>) {
    Object.assign(context, { lastError: null });
  }

  function assertLastAPIError(
    context: Partial<CaseContext>,
    options: {
      status?: number;
      method?: string;
      messageIncludes?: string;
    } = {},
  ) {
    expect(context.lastError).toBeTruthy();
    return assertAPIError(context.lastError, options);
  }

  function assertLastAPIErrorType(
    context: Partial<CaseContext>,
    expectedType: string,
  ) {
    const error = assertLastAPIError(context);
    expect(error.body).toBeTypeOf('object');
    const body = error.body as { type?: string };
    expect(body.type).toBe(expectedType);
  }

  function getCr7PoolForTestSupport() {
    const broker = scenarioContext.fixtures.values.broker as ServiceBroker;
    const cr7Service = broker.getLocalService('cr7') as unknown as ServiceWithPool;
    expect(cr7Service).toBeTruthy();
    return cr7Service.pool;
  }

  function resolveOperatorToken(operator: string) {
    if (operator === '管理员') {
      return scenarioContext.adminToken;
    }

    if (operator === '运营人员') {
      expect(scenarioContext.operatorToken).toBeTruthy();
      return scenarioContext.operatorToken!;
    }

    const user = scenarioContext.usersByName[operator];
    expect(user).toBeTruthy();
    return user.token;
  }

  function resolveOperatorProfileId(operator: string) {
    if (operator === '管理员') {
      return scenarioContext.adminProfile.id;
    }

    if (operator === '运营人员') {
      expect(scenarioContext.operatorProfile).toBeTruthy();
      return scenarioContext.operatorProfile!.id;
    }

    const user = scenarioContext.usersByName[operator];
    expect(user).toBeTruthy();
    return user.profile.id;
  }

  async function grantRoleToUser(
    userName: string,
    roleName: RoleName,
  ) {
    const user = scenarioContext.usersByName[userName];
    expect(user).toBeTruthy();

    const { apiServer } = scenarioContext.fixtures.values;
    const result = await grantRoleToUserAPI(
      apiServer,
      scenarioContext.adminToken,
      user.profile.id,
      roleName,
    );

    if (roleName === 'OPERATOR') {
      Object.assign(scenarioContext, {
        operatorToken: user.token,
        operatorProfile: user.profile,
      });
    }

    return result;
  }

  async function expireCurrentRedemption(context: Partial<CaseContext>) {
    const pool = getCr7PoolForTestSupport();
    // Set valid_until to valid_from + 1 second: satisfies the DB constraint (valid_until > valid_from)
    // and makes the code immediately expired since now >> valid_from + 1s
    await pool.query(
      `UPDATE ${schema}.exhibit_redemption_codes
      SET
        valid_until = valid_from + INTERVAL '1 second',
        updated_at = NOW()
      WHERE order_id = $1`,
      [context.order!.id],
    );
  }

  async function performRedeem(
    context: Partial<CaseContext>,
    token: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const redeemed = await redeemCode(
      apiServer,
      context.exhibition!.id,
      context.redemption!.code,
      token,
    );

    Object.assign(context, { redemption: redeemed });
  }

  Background(({ Given }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const adminToken = await prepareAdminToken(apiServer, schema);
      const adminProfile = await getUserProfile(apiServer, adminToken);

      Object.assign(scenarioContext, {
        adminToken,
        adminProfile,
      });
    });

    Given('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
      const { apiServer } = scenarioContext.fixtures.values;
      const token = await registerUser(apiServer, `${userName}_${Date.now()}`);
      const profile = await getUserProfile(apiServer, token);

      Object.assign(scenarioContext, {
        userToken: userName === 'Alice' ? token : scenarioContext.userToken,
        usersByName: {
          ...scenarioContext.usersByName,
          [userName]: { token, profile },
        },
      });
    });
  });

  Scenario(
    '一个完成支付的订单拥有一个核销码',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('{string} 票种准入人数为 {string}', (_ctx, _ticketName: string, admittance: string) => {
        expect(context.ticket?.admittance).toBe(Number(admittance));
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
        await payOrderForCurrentUser(context);
      });

      When('用户查询订单核销信息', async () => {
        clearLastError(context);
        await fetchOrderRedemption(context);
      });

      Then('订单详情中包含一个核销码', () => {
        expect(context.redemption).toBeTruthy();
        expect(context.redemption?.order_id).toBe(context.order?.id);
      });

      And('核销码的长度为 {string} 位', (_ctx, length: string) => {
        expect(context.redemption?.code).toHaveLength(Number(length));
      });

      And('核销码的第一位是 {string} 先做保留字', (_ctx, prefix: string) => {
        expect(context.redemption?.code.startsWith(prefix)).toBe(true);
      });

      And('核销码最后两位是 Luhn 校验码且正确', () => {
        expect(isValidRedemptionCodeLuhn(context.redemption!.code)).toBe(true);
      });

      And(
        '核销码中间的9位字符集 {string} 组成, 不包含易混淆的字符如 {string}, {string}, {string}, {string}',
        (_ctx, charset: string, c1: string, c2: string, c3: string, c4: string) => {
        const middle = context.redemption!.code.slice(1, 10);
        expect(middle).toHaveLength(9);
        for (const char of middle) {
          expect(charset.includes(char)).toBe(true);
        }
        expect(middle.includes(c1)).toBe(false);
        expect(middle.includes(c2)).toBe(false);
        expect(middle.includes(c3)).toBe(false);
        expect(middle.includes(c4)).toBe(false);
      });

      And('核销码的状态为未核销', () => {
        expect(context.redemption?.status).toBe('UNREDEEMED');
        expect(context.redemption?.redeemed_at).toBeNull();
        expect(context.redemption?.redeemed_by).toBeNull();
      });

      And('核销码下有两张 {string} 票', (_ctx, ticketName: string) => {
        expect(context.redemption?.items).toHaveLength(1);
        expect(context.redemption?.items[0].category_name).toBe(ticketName);
        expect(context.redemption?.items[0].quantity).toBe(2);
      });

      And('核销码的准入人数为 {string}', (_ctx, quantity: string) => {
        expect(context.redemption?.quantity).toBe(Number(quantity));
      });

      And('核销码的有效期为场次当天', () => {
        const validFrom = new Date(context.redemption!.valid_from);
        const validUntil = new Date(context.redemption!.valid_until);
        // valid_from: local midnight of the session day
        expect(validFrom.getHours()).toBe(0);
        expect(validFrom.getMinutes()).toBe(0);
        expect(validFrom.getSeconds()).toBe(0);
        // valid_until: local midnight of the NEXT day (right-open, exclusive)
        const expectedUntil = new Date(
          validFrom.getFullYear(), validFrom.getMonth(), validFrom.getDate() + 1,
        );
        expect(validUntil.getTime()).toBe(expectedUntil.getTime());
      });
    },
  );

  Scenario(
    '使用核销码完成订单核销',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
        await payOrderForCurrentUser(context);
        await fetchOrderRedemption(context);
      });

      When('{string}将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(scenarioContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        try {
          await performRedeem(context, token);
          clearLastError(context);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('核销成功', () => {
        expect(context.lastError).toBeFalsy();
        expect(context.redemption?.status).toBe('REDEEMED');
      });

      And('核销码状态变为 {string}', (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('已核销');
        expect(context.redemption?.status).toBe('REDEEMED');
      });

      And('核销码的核销时间被记录', () => {
        expect(context.redemption?.redeemed_at).toBeTruthy();
      });

      And('核销码的核销人为 {string}', (_ctx, operator: string) => {
        const operatorId = resolveOperatorProfileId(operator);
        expect(context.redemption?.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '一个未完成支付的订单没有核销码',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个未完成支付订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
      });

      When('用户查询订单核销信息', async () => {
        clearLastError(context);
        try {
          await fetchOrderRedemption(context);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('查询核销信息失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'GET' });
      });

      And('查询核销信息错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });
    },
  );

  Scenario(
    '已过期订单的核销码不可用',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
        await payOrderForCurrentUser(context);
        await fetchOrderRedemption(context);
      });

      And('核销码已过期', async () => {
        await expireCurrentRedemption(context);
      });

      When('{string}将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(scenarioContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        clearLastError(context);
        try {
          await performRedeem(context, token);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('核销失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'POST' });
      });

      And('核销失败错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });
    },
  );

  Scenario(
    '已核销订单的核销码不可重复使用',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
        await payOrderForCurrentUser(context);
        await fetchOrderRedemption(context);
      });

      When('{string}将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(scenarioContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        clearLastError(context);
        try {
          await performRedeem(context, token);
        } catch (error) {
          rememberError(context, error);
        }
      });

      And('{string}再次将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(scenarioContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        clearLastError(context);
        try {
          await performRedeem(context, token);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('再次核销失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'POST' });
      });

      And('核销失败错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });
    },
  );

  Scenario(
    '只有运营人员才能核销',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
        await payOrderForCurrentUser(context);
        await fetchOrderRedemption(context);
      });

      And('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const token = await registerUser(apiServer, `${userName}_${Date.now()}`);
        const profile = await getUserProfile(apiServer, token);

        Object.assign(scenarioContext, {
          usersByName: {
            ...scenarioContext.usersByName,
            [userName]: { token, profile },
          },
        });
      });

      And('用户 {string} 被授予 {string} 角色', async (_ctx, userName: string, roleLabel: string) => {
        expect(roleLabel).toBe('运营');
        await grantRoleToUser(userName, 'OPERATOR');
      });

      When('用户 {string} 尝试核销用户 {string} 的订单核销码', async (_ctx, actorName: string, userName: string) => {
        expect(scenarioContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(actorName);

        clearLastError(context);
        try {
          await performRedeem(context, token);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('核销失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'POST' });
      });

      And('核销失败错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });

      When('{string}将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(scenarioContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        clearLastError(context);
        try {
          await performRedeem(context, token);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('核销成功', () => {
        expect(context.lastError).toBeFalsy();
        expect(context.redemption?.status).toBe('REDEEMED');
      });

      And('核销码的核销人为 {string}', (_ctx, operator: string) => {
        const operatorId = resolveOperatorProfileId(operator);
        expect(context.redemption?.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '当天场次的核销码从今天零点起有效',
    (s: StepTest<Partial<CaseContext>>) => {
      const { Given, And, When, Then, context } = s;

      Given('展览活动 {string} 已创建，包含场次 {string} 和票种 {string}', async (_ctx, exhibitionName: string, sessionDate: string, ticketName: string) => {
        await prepareExhibitionData(context, exhibitionName, sessionDate, ticketName, 1, 2);
      });

      And('{string} 票种的有效期为场次当天有效', (_ctx, _ticketName: string) => {
        expect(context.ticket?.valid_duration_days).toBe(1);
      });

      And('场次 {string} 的 {string} 库存初始为 {int}', (_ctx, _sessionDate: string, _ticketName: string, quantity: number) => {
        expect(quantity).toBe(2);
      });

      Given('用户在一个订单里购买了 {int} 张 {string} 的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        await createOrderForCurrentUser(context, quantity);
        await payOrderForCurrentUser(context);
        await fetchOrderRedemption(context);
      });

      When('用户查询订单核销信息', async () => {
        await fetchOrderRedemption(context);
      });

      Then('核销码的有效期起始时间不晚于当前时间', () => {
        // Regression test: valid_from must be local midnight, not UTC midnight.
        // If toValidityStartDate used Date.UTC(), valid_from in UTC+8 would be 8 hours in the
        // future, making the code appear expired immediately after purchase.
        const validFrom = new Date(context.redemption!.valid_from);
        expect(validFrom.getTime()).toBeLessThanOrEqual(Date.now());
        // Explicit: valid_from must be exactly today's local midnight (00:00:00.000)
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        expect(validFrom.getTime()).toBe(todayMidnight.getTime());
      });

      And('"管理员"将用户 "Alice" 的订单核销码立即扫码核销成功', async () => {
        const token = resolveOperatorToken('管理员');
        clearLastError(context);
        try {
          await performRedeem(context, token);
        } catch (error) {
          rememberError(context, error);
        }
        expect(context.lastError).toBeFalsy();
        expect(context.redemption?.status).toBe('REDEEMED');
      });
    },
  );
});
