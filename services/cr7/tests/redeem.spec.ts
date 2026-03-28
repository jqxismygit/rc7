import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { Exhibition, Order, Payment, Redeem, User } from '@cr7/types';
import { expect, vi } from 'vitest';
import type { ServiceBroker } from 'moleculer';
import type { Pool } from 'pg';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { services_fixtures } from './fixtures/services.js';
import { prepareAdminUser, registerUser, getUserProfile } from './fixtures/user.js';
import {
  prepareExhibitionSessionTicket,
} from './fixtures/exhibition.js';
import { createOrder as createOrderByApi } from './fixtures/order.js';
import {
  getOrderRedemption,
  isValidRedemptionCodeLuhn,
  redeemCode,
  toSessionDateLabel,
} from './fixtures/redeem.js';
import { grantRoleToUser as grantRoleToUserAPI } from './fixtures/user.js';
import {
  markOrderAsPaidForTest,
  requestRefundWithMock,
  sendMockRefundCallback,
} from './fixtures/payment.js';
import { getOrder } from './fixtures/order.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';

const schema = 'test_redeem';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/redeem.feature');

type ExhibitionContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticket: Exhibition.TicketCategory;
};

type OrderContext = {
  order: Order.OrderWithItems;
};

type RedemptionContext = {
  redemption: Redeem.RedemptionCodeWithOrder;
};

type RefundContext = {
  refundRecord: Payment.RefundRecord;
};

type ErrorContext = {
  lastError: unknown;
};

type PreparedExhibitionContext = {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticket: Exhibition.TicketCategory;
};

type RoleName = 'ADMIN' | 'OPERATOR';

type ServiceWithPool = {
  pool: Pick<Pool, 'query'>;
};

interface DefaultUserContext {
  adminToken: string;
  userToken: string;
}

interface FeatureContext extends DefaultUserContext, ExhibitionContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
  adminProfile: User.Profile;
  operatorToken?: string;
  operatorProfile?: User.Profile;
  usersByName: Record<string, { token: string; profile: User.Profile }>;
}

async function createOrderForCurrentUser(
  featureContext: FeatureContext,
  quantity: number
): Promise<Order.OrderWithItems> {
  const { exhibition, session, ticket, userToken, fixtures } = featureContext;
  const { apiServer } = fixtures.values;

  const order = await createOrderByApi(
    apiServer,
    exhibition.id,
    session.id,
    [{ ticket_category_id: ticket.id, quantity }],
    userToken,
  );

  return order;
}

async function performRedeem(
  featureContext: FeatureContext,
  redemption: Redeem.RedemptionCodeWithOrder,
  token: string,
): Promise<Redeem.RedemptionCodeWithOrder> {
  const { exhibition, fixtures } = featureContext;
  const { apiServer } = fixtures.values;
  const redeemed = await redeemCode(
    apiServer,
    exhibition.id,
    redemption.code,
    token,
  );

  return redeemed;
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
    const fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer', 'broker'],
    );


    featureContext.fixtures = fixtures;
    featureContext.usersByName = {};
  });

  AfterAllScenarios(async () => {
    await featureContext.fixtures.close();
  });

  async function prepareExhibitionData(
    exhibitionName: string,
    sessionDateInput: string,
    ticketName: string,
    admittance: number,
    inventory: number,
    refundPolicy: 'NON_REFUNDABLE' | 'REFUNDABLE_48H_BEFORE' = 'NON_REFUNDABLE',
  ): Promise<PreparedExhibitionContext> {
    const { apiServer } = featureContext.fixtures.values;
    const sessionDate = toSessionDateLabel(sessionDateInput);

    const prepared = await prepareExhibitionSessionTicket(
      apiServer,
      featureContext.adminToken,
      {
        exhibitionOverrides: {
          name: `${exhibitionName}_${Date.now()}`,
          description: 'redeem test exhibition',
          start_date: sessionDate,
          end_date: sessionDate,
        },
        ticketOverrides: {
          name: ticketName,
          valid_duration_days: 1,
          refund_policy: refundPolicy,
          admittance,
        },
        maxInventory: inventory,
      },
    );

    return prepared;
  }


  async function payOrderForCurrentUser(context: OrderContext) {
    const { apiServer } = featureContext.fixtures.values;
    const user = featureContext.usersByName.Alice;
    expect(user).toBeTruthy();
    expect(user.profile.openid).toBeTruthy();

    await markOrderAsPaidForTest(
      apiServer,
      featureContext.userToken,
      context.order,
      user.profile.openid!,
    );
  }

  async function fetchOrderRedemption(order: Order.OrderWithItems): Promise<Redeem.RedemptionCodeWithOrder> {
    const { apiServer } = featureContext.fixtures.values;
    const redemption = await getOrderRedemption(
      apiServer,
      order.id,
      featureContext.userToken,
    );

    return redemption;
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

  function assertLastAPIErrorType(
    context: ErrorContext,
    expectedType: string,
  ) {
    const error = assertLastAPIError(context);
    expect(error.body).toBeTypeOf('object');
    const body = error.body as { type?: string };
    expect(body.type).toBe(expectedType);
  }

  async function sendRefundStatusNotification(
    context: RefundContext,
    status: 'PROCESSING' | 'SUCCESS',
  ) {
    await sendMockRefundCallback(
      featureContext.fixtures.values.apiServer,
      context.refundRecord,
      status,
      {
        successTime: status === 'SUCCESS' ? new Date().toISOString() : undefined,
      },
    );
  }

  async function refreshOrder(context: OrderContext) {
    return getOrder(
      featureContext.fixtures.values.apiServer,
      context.order.id,
      featureContext.userToken,
    );
  }

  function getCr7PoolForTestSupport() {
    const broker = featureContext.fixtures.values.broker as ServiceBroker;
    const cr7Service = broker.getLocalService('cr7') as unknown as ServiceWithPool;
    expect(cr7Service).toBeTruthy();
    return cr7Service.pool;
  }

  function resolveOperatorToken(operator: string) {
    if (operator === '管理员') {
      return featureContext.adminToken;
    }

    if (operator === '运营人员') {
      expect(featureContext.operatorToken).toBeTruthy();
      return featureContext.operatorToken!;
    }

    const user = featureContext.usersByName[operator];
    expect(user).toBeTruthy();
    return user.token;
  }

  function resolveOperatorProfileId(operator: string) {
    if (operator === '管理员') {
      return featureContext.adminProfile.id;
    }

    if (operator === '运营人员') {
      expect(featureContext.operatorProfile).toBeTruthy();
      return featureContext.operatorProfile!.id;
    }

    const user = featureContext.usersByName[operator];
    expect(user).toBeTruthy();
    return user.profile.id;
  }

  async function grantRoleToUser(
    userName: string,
    roleName: RoleName,
  ) {
    const user = featureContext.usersByName[userName];
    expect(user).toBeTruthy();

    const { apiServer } = featureContext.fixtures.values;
    const result = await grantRoleToUserAPI(
      apiServer,
      featureContext.adminToken,
      user.profile.id,
      roleName,
    );

    if (roleName === 'OPERATOR') {
      featureContext.operatorToken = user.token;
      featureContext.operatorProfile = user.profile;
    }

    return result;
  }

  async function expireCurrentRedemption(context: OrderContext) {
    const pool = getCr7PoolForTestSupport();
    // Set valid_until to valid_from + 1 second: satisfies the DB constraint (valid_until > valid_from)
    // and makes the code immediately expired since now >> valid_from + 1s
    await pool.query(
      `UPDATE ${schema}.exhibit_redemption_codes
      SET
        valid_until = valid_from + INTERVAL '1 second',
        updated_at = NOW()
      WHERE order_id = $1`,
      [context.order.id],
    );
  }


  Background(({ Given }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext.fixtures.values;
      const { token: adminToken, profile: adminProfile } = await prepareAdminUser(apiServer, schema);
      featureContext.adminToken = adminToken;
      featureContext.adminProfile = adminProfile;
    });

    Given('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;
      const token = await registerUser(apiServer, `${userName}_${Date.now()}`);
      const profile = await getUserProfile(apiServer, token);

      if (userName === 'Alice') {
        featureContext.userToken = token;
      }
      featureContext.usersByName = {
        ...featureContext.usersByName,
        [userName]: { token, profile },
      };
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      const prepared = await prepareExhibitionData('CR7', startDate, 'early_bird', 1, 2);
      featureContext.exhibition = prepared.exhibition;
      featureContext.session = prepared.session;
      featureContext.ticket = prepared.ticket;
      expect(featureContext.ticket?.name).toBe('early_bird');
      expect(toSessionDateLabel(startDate)).toBe(toSessionDateLabel(endDate));
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (_ctx, ticketName: string, admittance: number) => {
      expect(featureContext.ticket).toBeTruthy();
      expect(featureContext.ticket?.name).toBe(ticketName);
      expect(featureContext.ticket?.admittance).toBe(admittance);
      expect(featureContext.ticket?.valid_duration_days).toBe(1);
    });

    Given('{string} 库存为 {int}', async (_ctx, ticketName: string, maxInventory: number) => {
      expect(featureContext.ticket).toBeTruthy();
      expect(featureContext.ticket?.name).toBe(ticketName);
      const { apiServer } = featureContext.fixtures.values;
      const { adminToken, exhibition, ticket } = featureContext;
      await expect(updateTicketCategoryMaxInventory(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        maxInventory,
      )).resolves.not.toThrow();
    });  });

  Scenario(
    '一个完成支付的订单拥有一个核销码',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
        await payOrderForCurrentUser(context);
      });

      Given('用户完成支付', async () => {
        // Payment is completed in booking step in this scenario.
      });

      When('用户查询订单核销信息', async () => {
        context.redemption = await fetchOrderRedemption(context.order);
      });

      Then('订单详情中包含一个核销码', () => {
        expect(context.redemption).toBeTruthy();
        expect(context.redemption.order_id).toBe(context.order?.id);
      });

      And('核销码的长度为 {string} 位', (_ctx, length: string) => {
        expect(context.redemption.code).toHaveLength(Number(length));
      });

      And('核销码的第一位是 {string} 先做保留字', (_ctx, prefix: string) => {
        expect(context.redemption.code.startsWith(prefix)).toBe(true);
      });

      And('核销码最后两位是 Luhn 校验码且正确', () => {
        expect(isValidRedemptionCodeLuhn(context.redemption.code)).toBe(true);
      });

      And(
        '核销码中间的9位字符集 {string} 组成, 不包含易混淆的字符如 {string}, {string}, {string}, {string}',
        (_ctx, charset: string, c1: string, c2: string, c3: string, c4: string) => {
        const middle = context.redemption.code.slice(1, 10);
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
        expect(context.redemption.status).toBe('UNREDEEMED');
        expect(context.redemption.redeemed_at).toBeNull();
        expect(context.redemption.redeemed_by).toBeNull();
      });

      And('核销码下有两张 {string} 票', (_ctx, ticketName: string) => {
        expect(context.redemption.items).toHaveLength(1);
        expect(context.redemption.items[0].category_name).toBe(ticketName);
        expect(context.redemption.items[0].quantity).toBe(2);
      });

      And('核销码的准入人数为 {string}', (_ctx, quantity: string) => {
        expect(context.redemption.quantity).toBe(Number(quantity));
      });

      And('核销码的有效期为场次当天', () => {
        const redemption = context.redemption;
        const validFrom = new Date(redemption.valid_from);
        const validUntil = new Date(redemption.valid_until);
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
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      When('用户完成支付', async () => {
        // Payment is completed in booking step in this scenario.
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      When('{string} 将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        context.redemption = await performRedeem(featureContext, context.redemption, token);
      });

      Then('核销成功', () => {
        expect(context.lastError).toBeFalsy();
        expect(context.redemption.status).toBe('REDEEMED');
      });

      And('核销码状态变为 {string}', (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('已核销');
        expect(context.redemption.status).toBe('REDEEMED');
      });

      And('核销码的核销时间被记录', () => {
        expect(context.redemption.redeemed_at).toBeTruthy();
      });

      And('核销码的核销人为 {string}', (_ctx, operator: string) => {
        const operatorId = resolveOperatorProfileId(operator);
        expect(context.redemption.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '一个未完成支付的订单没有核销码',
    (s: StepTest<OrderContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;


      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
      });

      When('用户查询订单核销信息', async () => {
        try {
          await fetchOrderRedemption(context.order);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'GET' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });
    },
  );

  Scenario(
    '已过期订单的核销码不可用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      When('用户完成支付', async () => {
        // Payment is completed in booking step in this scenario.
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      Given('核销码已过期', async () => {
        await expireCurrentRedemption(context);
      });

      When('{string} 将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        try {
          context.redemption = await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'POST' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });
    },
  );

  Scenario(
    '已核销订单的核销码不可重复使用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      When('用户完成支付', async () => {
        // Payment is completed in booking step in this scenario.
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      When('{string} 将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        try {
          context.redemption = await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('核销成功', () => {
        expect(context.lastError).toBeFalsy();
        expect(context.redemption.status).toBe('REDEEMED');
      });

      When('{string} 再次将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'POST' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });
    },
  );

  Scenario(
    '只有运营人员才能核销',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      When('用户完成支付', async () => {
        // Payment is completed in booking step in this scenario.
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      Given('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
        const { apiServer } = featureContext.fixtures.values;
        const token = await registerUser(apiServer, `${userName}_${Date.now()}`);
        const profile = await getUserProfile(apiServer, token);

        featureContext.usersByName = {
          ...featureContext.usersByName,
          [userName]: { token, profile },
        };
      });

      And('用户 {string} 被授予 {string} 角色', async (_ctx, userName: string, roleLabel: string) => {
        expect(roleLabel).toBe('运营');
        await grantRoleToUser(userName, 'OPERATOR');
      });

      When('用户 {string} 尝试核销用户 {string} 的订单核销码', async (_ctx, actorName: string, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(actorName);

        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, { status: statusCode, method: 'POST' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        assertLastAPIErrorType(context, errorType);
      });

      When('{string} 将用户 {string} 的订单核销码扫码核销', async (_ctx, operator: string, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = resolveOperatorToken(operator);

        context.lastError = null;
        try {
          context.redemption = await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('核销成功', () => {
        expect(context.lastError).toBeFalsy();
        expect(context.redemption.status).toBe('REDEEMED');
      });

      And('核销码的核销人为 {string}', (_ctx, operator: string) => {
        const operatorId = resolveOperatorProfileId(operator);
        expect(context.redemption.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '当天场次的核销码从今天零点起有效',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number) => {
        context.order = await createOrderForCurrentUser(featureContext, quantity);
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      When('用户完成支付', async () => {
        // Payment is completed in booking step in this scenario.
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      And('核销码的有效期起始时间不晚于当前时间', () => {
        // Regression test: valid_from must be local midnight, not UTC midnight.
        // If toValidityStartDate used Date.UTC(), valid_from in UTC+8 would be 8 hours in the
        // future, making the code appear expired immediately after purchase.
        const validFrom = new Date(context.redemption.valid_from);
        expect(validFrom.getTime()).toBeLessThanOrEqual(Date.now());
        // Explicit: valid_from must be exactly today's local midnight (00:00:00.000)
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        expect(validFrom.getTime()).toBe(todayMidnight.getTime());
      });

      And('"管理员" 将用户 "Alice" 的订单核销码立即扫码核销成功', async () => {
        const token = resolveOperatorToken('管理员');
        await expect(performRedeem(featureContext, context.redemption, token)).resolves.to.toMatchObject({
          status: 'REDEEMED',
        });
      });
    },
  );

  Scenario(
    '已经核销的订单不能发起退款',
    (s: StepTest<ExhibitionContext & OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDateLabel: string, ticketName: string) => {
        const prepared = await prepareExhibitionData(
          'CR7',
          sessionDateLabel,
          ticketName,
          1,
          10,
          'REFUNDABLE_48H_BEFORE',
        );
        context.exhibition = prepared.exhibition;
        context.session = prepared.session;
        context.ticket = prepared.ticket;
        featureContext.exhibition = prepared.exhibition;
        featureContext.session = prepared.session;
        featureContext.ticket = prepared.ticket;
        context.order = await createOrderForCurrentUser(featureContext, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      Given('订单已被核销', async () => {
        const token = resolveOperatorToken('管理员');
        context.redemption = await performRedeem(featureContext, context.redemption, token);
      });

      When('用户发起退款请求', async () => {
        try {
          await requestRefundWithMock(
            featureContext.fixtures.values.apiServer,
            context.order,
            featureContext.userToken,
          );
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        assertLastAPIError(context, {
          status: statusCode,
          method: 'POST',
        });
      });

      And('错误信息包含 {string}', (_ctx, message: string) => {
        assertLastAPIError(context, {
          status: 409,
          method: 'POST',
          messageIncludes: message,
        });
      });

      And('订单状态仍然为 {string}', async (_ctx, statusLabel: string) => {
        const order = await refreshOrder(context);
        if (statusLabel === '已支付') {
          expect(order.status).toBe('PAID');
        }
      });
    },
  );

  Scenario(
    '已经处于退款流程的订单不能被核销',
    (s: StepTest<ExhibitionContext & OrderContext & RedemptionContext & RefundContext & ErrorContext>) => {
      const { Given, When, Then, context } = s;

      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDateLabel: string, ticketName: string) => {
        const prepared = await prepareExhibitionData(
          'CR7',
          sessionDateLabel,
          ticketName,
          1,
          10,
          'REFUNDABLE_48H_BEFORE',
        );
        context.exhibition = prepared.exhibition;
        context.session = prepared.session;
        context.ticket = prepared.ticket;
        featureContext.exhibition = prepared.exhibition;
        featureContext.session = prepared.session;
        featureContext.ticket = prepared.ticket;
        context.order = await createOrderForCurrentUser(featureContext, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(context);
        context.redemption = await fetchOrderRedemption(context.order);
      });

      Then('用户有一个有效的核销码', () => {
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      Given('用户已发起退款请求，订单状态为 {string}', async (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('退款已受理');
        const { refundRecord } = await requestRefundWithMock(
          featureContext.fixtures.values.apiServer,
          context.order,
          featureContext.userToken,
        );
        context.refundRecord = refundRecord;

        const order = await refreshOrder(context);
        expect(order.status).toBe('REFUND_REQUESTED');
      });

      When('{string}扫码核销用户的订单核销码', async (_ctx, operator: string) => {
        const token = resolveOperatorToken(operator);
        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('核销失败，状态码为 {int}, 错误信息为 {string}', (_ctx, statusCode: number, message: string) => {
        assertLastAPIError(context, {
          status: statusCode,
          method: 'POST',
          messageIncludes: message,
        });
      });

      Then('退款处理中导致再次核销失败，状态码为 {int}, 错误信息为 {string}', (_ctx, statusCode: number, message: string) => {
        assertLastAPIError(context, {
          status: statusCode,
          method: 'POST',
          messageIncludes: message,
        });
      });

      Given('微信支付服务通知 cr7 支付服务退款状态为 {string}', async (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('退款处理中');
        await sendRefundStatusNotification(context, 'PROCESSING');

        const order = await refreshOrder(context);
        expect(order.status).toBe('REFUND_PROCESSING');
      });

      When('{string}再次扫码核销用户的订单核销码', async (_ctx, operator: string) => {
        const token = resolveOperatorToken(operator);
        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Given('微信支付服务通知 cr7 支付服务退款结果，退款成功', async () => {
        await sendRefundStatusNotification(context, 'SUCCESS');

        const order = await refreshOrder(context);
        expect(order.status).toBe('REFUNDED');
      });

      When('{string}在退款成功后再次扫码核销用户的订单核销码', async (_ctx, operator: string) => {
        const token = resolveOperatorToken(operator);
        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('退款成功导致的核销失败，状态码为 {int}, 错误信息为 {string}', (_ctx, statusCode: number, message: string) => {
        assertLastAPIError(context, {
          status: statusCode,
          method: 'POST',
          messageIncludes: message,
        });
      });
    },
  );
});
