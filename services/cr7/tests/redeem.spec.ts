import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { isSameDay } from 'date-fns';
import { Exhibition, Order, Payment, Redeem, User } from '@cr7/types';
import { expect, vi } from 'vitest';
import type { ServiceBroker } from 'moleculer';
import type { Pool } from 'pg';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { assertAPIError } from './lib/api.js';
import { Text2Date, toDateLabel } from './lib/relative-date.js';
import { services_fixtures } from './fixtures/services.js';
import { registerUser, getUserProfile, prepareAdminToken } from './fixtures/user.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
} from './fixtures/exhibition.js';
import { createOrder as createOrderByApi } from './fixtures/order.js';
import {
  getOrderRedemption,
  isValidRedemptionCodeLuhn,
  redeemCode,
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
  sessions: Exhibition.Session[];
  ticketByName: Record<string, Exhibition.TicketCategory>;
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

type ServiceWithPool = {
  pool: Pick<Pool, 'query'>;
};

interface DefaultUserContext {
  adminToken: string;
  userToken: string;
  userProfile: User.Profile;
  operatorToken: string;
  operatorProfile: User.Profile;
  usersByName: Record<string, { token: string; profile: User.Profile }>;
}

interface FeatureContext extends DefaultUserContext, ExhibitionContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer' | 'broker'>;
}

function getSessionByDate(
  sessions: Exhibition.Session[],
  dateLabel: string,
): Exhibition.Session {
  const targetDate = Text2Date(dateLabel);
  const session = sessions.find((item) => isSameDay(item.session_date, targetDate));
  expect(session, `Session for ${dateLabel} (${targetDate}) not found`).toBeTruthy();
  return session!;
}

async function createOrderForCurrentUser(
  featureContext: FeatureContext,
  sessionDate: string,
  ticketName: string,
  quantity: number,
): Promise<Order.OrderWithItems> {
  const { exhibition, sessions, ticketByName, userToken, fixtures } = featureContext;
  const { apiServer } = fixtures.values;
  const session = getSessionByDate(sessions, sessionDate);
  const ticket = ticketByName[ticketName];
  expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
  return createOrderByApi(
    apiServer,
    exhibition.id,
    session.id,
    [{ ticket_category_id: ticket.id, quantity }],
    userToken,
  );
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

async function payOrderForCurrentUser(
  featureContext: FeatureContext,
  order: Order.OrderWithItems
) {
  const { userProfile, userToken, fixtures } = featureContext
  const { apiServer } = fixtures.values;
  await markOrderAsPaidForTest(apiServer, userToken, order, userProfile.openid!);
}

async function expireRedemptionForOrder(
  featureContext: FeatureContext,
  orderId: string,
): Promise<void> {
  const broker = featureContext.fixtures.values.broker as ServiceBroker;
  const cr7Service = broker.getLocalService('cr7') as unknown as ServiceWithPool;
  expect(cr7Service).toBeTruthy();
  // Keep valid_until > valid_from while making the code effectively expired now.
  await cr7Service.pool.query(
    `UPDATE ${schema}.exhibit_redemption_codes
    SET
      valid_until = valid_from + INTERVAL '1 second',
      updated_at = NOW()
    WHERE order_id = $1`,
    [orderId],
  );
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

  Background(({ Given, And }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext.fixtures.values;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);;
    });

    Given('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;
      const token = await registerUser(apiServer, `${userName}_${Date.now()}`);
      const profile = await getUserProfile(apiServer, token);
      featureContext.userToken = token;
      featureContext.userProfile = profile;
      featureContext.usersByName[userName] = { token, profile };
    });

    Given('{string} 已注册并登录', async (_ctx, userName: string) => {
      const { apiServer } = featureContext.fixtures.values;
      const token = await registerUser(apiServer, `${userName}_${Date.now()}`);
      const profile = await getUserProfile(apiServer, token);
      featureContext.operatorToken = token;
      featureContext.operatorProfile = profile;
      featureContext.usersByName[userName] = { token, profile };
    });

    And('{string} 被授予 {string} 角色', async (_ctx, userName: string, roleLabel: string) => {
      expect(roleLabel).toBe('运营');
      const user = featureContext.usersByName[userName];
      expect(user).toBeTruthy();
      await grantRoleToUserAPI(
        featureContext.fixtures.values.apiServer,
        featureContext.adminToken,
        user.profile.id,
        'OPERATOR',
      );
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      const { fixtures, adminToken } = featureContext;
      const { apiServer } = fixtures.values;
      featureContext.exhibition = await prepareExhibition(apiServer, adminToken, {
        name: `CR7_${Date.now()}`,
        description: 'redeem test exhibition',
        start_date: toDateLabel(startDate),
        end_date: toDateLabel(endDate),
      });
      featureContext.sessions = await getSessions(apiServer, featureContext.exhibition.id, adminToken);
      featureContext.ticketByName = {};
      expect(featureContext.sessions.length).toBeGreaterThan(0);
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (_ctx, ticketName: string, admittance: number) => {
      const { fixtures, adminToken, exhibition, ticketByName } = featureContext;
      const { apiServer } = fixtures.values;
      const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
        name: ticketName,
        admittance,
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
      });
      featureContext.ticketByName = { ...ticketByName, [ticketName]: ticket };
    });

    Given('{string} 库存为 {int}', async (_ctx, ticketName: string, maxInventory: number) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
      const { apiServer } = featureContext.fixtures.values;
      const { adminToken, exhibition } = featureContext;
      await updateTicketCategoryMaxInventory(apiServer, adminToken, exhibition.id, ticket.id, maxInventory);
    });
  });

  Scenario(
    '一个完成支付的订单拥有一个核销码',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      Given('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      When('用户查询订单核销信息', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
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
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = featureContext.operatorToken;

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

      And('核销码的核销人为运营人员', () => {
        const operatorId = featureContext.operatorProfile.id;
        expect(context.redemption.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '一个未完成支付的订单没有核销码',
    (s: StepTest<OrderContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;


      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户查询订单核销信息', async () => {
        try {
          await getOrderRedemption(
            featureContext.fixtures.values.apiServer,
            context.order.id,
            featureContext.userToken,
          );
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, { status: statusCode, method: 'GET' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        expect(context.lastError).toBeTruthy();
        const error = assertAPIError(context.lastError, {});
        expect(error.body).toBeTypeOf('object');
        const body = error.body as { type?: string };
        expect(body.type).toBe(errorType);
      });
    },
  );

  Scenario(
    '已过期订单的核销码不可用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      Given('核销码已过期', async () => {
        await expireRedemptionForOrder(featureContext, context.order.id);
      });

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = featureContext.operatorToken;

        try {
          context.redemption = await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, { status: statusCode, method: 'POST' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        expect(context.lastError).toBeTruthy();
        const error = assertAPIError(context.lastError, {});
        expect(error.body).toBeTypeOf('object');
        const body = error.body as { type?: string };
        expect(body.type).toBe(errorType);
      });
    },
  );

  Scenario(
    '已核销订单的核销码不可重复使用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = featureContext.operatorToken;

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

      When('运营人员再次将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = featureContext.operatorToken;

        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, { status: statusCode, method: 'POST' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        expect(context.lastError).toBeTruthy();
        const error = assertAPIError(context.lastError, {});
        expect(error.body).toBeTypeOf('object');
        const body = error.body as { type?: string };
        expect(body.type).toBe(errorType);
      });
    },
  );

  Scenario(
    '只有运营人员才能核销',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      When('用户 "Alice" 尝试核销用户 {string} 的订单核销码', async (_ctx, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = featureContext.usersByName.Alice.token;

        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('操作失败，状态码为 {int}', (_ctx, statusCode: number) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, { status: statusCode, method: 'POST' });
      });

      And('错误类型为 {string}', (_ctx, errorType: string) => {
        expect(context.lastError).toBeTruthy();
        const error = assertAPIError(context.lastError, {});
        expect(error.body).toBeTypeOf('object');
        const body = error.body as { type?: string };
        expect(body.type).toBe(errorType);
      });

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        expect(featureContext.usersByName[userName]).toBeTruthy();
        const token = featureContext.operatorToken;

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

      And('核销码的核销人为 "运营人员"', () => {
        const operatorId = featureContext.operatorProfile.id;
        expect(context.redemption.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '当天场次的核销码从今天零点起有效',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;
      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
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

      And('运营人员将用户 "Alice" 的订单核销码立即扫码核销成功', async () => {
        const token = featureContext.operatorToken;
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

      Given('该展会追加了一个 {string} 票种, 退票策略是 {string}', async (_ctx, ticketName: string, policyLabel: string) => {
        const policy = policyLabel.includes('48') ? 'REFUNDABLE_48H_BEFORE' : 'NON_REFUNDABLE';
        const { fixtures, adminToken, exhibition, ticketByName } = featureContext;
        const { apiServer } = fixtures.values;
        const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
          name: ticketName,
          refund_policy: policy,
          admittance: 1,
          valid_duration_days: 1,
        });
        featureContext.ticketByName = { ...ticketByName, [ticketName]: ticket };
      });

      And('{string} 库存为 {int}', async (_ctx, ticketName: string, maxInventory: number) => {
        const ticket = featureContext.ticketByName[ticketName];
        expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
        const { fixtures, adminToken, exhibition } = featureContext;
        const { apiServer } = fixtures.values;
        await updateTicketCategoryMaxInventory(apiServer, adminToken, exhibition.id, ticket.id, maxInventory);
      });

      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        const redemption = context.redemption;
        expect(redemption.status).toBe('UNREDEEMED');
      });

      Given('订单已被核销', async () => {
        const token = featureContext.operatorToken;
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
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, {
          status: statusCode,
          method: 'POST',
        });
      });

      And('错误信息包含 {string}', (_ctx, message: string) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, {
          status: 409,
          method: 'POST',
          messageIncludes: message,
        });
      });

      And('订单状态仍然为 {string}', async (_ctx, statusLabel: string) => {
        const order = await getOrder(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        if (statusLabel === '已支付') {
          expect(order.status).toBe('PAID');
        }
      });
    },
  );

  Scenario(
    '已经处于退款流程的订单不能被核销',
    (s: StepTest<ExhibitionContext & OrderContext & RedemptionContext & RefundContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;

      Given('该展会追加了一个 {string} 票种, 退票策略是 {string}', async (_ctx, ticketName: string, policyLabel: string) => {
        const policy = policyLabel.includes('48') ? 'REFUNDABLE_48H_BEFORE' : 'NON_REFUNDABLE';
        const { fixtures, adminToken, exhibition, ticketByName } = featureContext;
        const { apiServer } = fixtures.values;
        const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
          name: ticketName,
          refund_policy: policy,
          admittance: 1,
          valid_duration_days: 1,
        });
        featureContext.ticketByName = { ...ticketByName, [ticketName]: ticket };
      });

      And('{string} 库存为 {int}', async (_ctx, ticketName: string, maxInventory: number) => {
        const ticket = featureContext.ticketByName[ticketName];
        expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
        const { fixtures, adminToken, exhibition } = featureContext;
        const { apiServer } = fixtures.values;
        await updateTicketCategoryMaxInventory(apiServer, adminToken, exhibition.id, ticket.id, maxInventory);
      });

      Given('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        context.order = await createOrderForCurrentUser(featureContext, sessionDate, ticketName, quantity);
      });

      When('用户完成支付', async () => {
        await payOrderForCurrentUser(featureContext, context.order);
      });

      Then('用户有一个有效的核销码', async () => {
        context.redemption = await getOrderRedemption(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
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

        const order = await getOrder(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        expect(order.status).toBe('REFUND_REQUESTED');
      });

      When('运营人员扫码核销用户的订单核销码', async () => {
        const token = featureContext.operatorToken;
        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('核销失败，状态码为 {int}, 错误信息为 {string}', (_ctx, statusCode: number, message: string) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, {
          status: statusCode,
          method: 'POST',
          messageIncludes: message,
        });
      });

      Then('退款处理中导致再次核销失败，状态码为 {int}, 错误信息为 {string}', (_ctx, statusCode: number, message: string) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, {
          status: statusCode,
          method: 'POST',
          messageIncludes: message,
        });
      });

      Given('微信支付服务通知 cr7 支付服务退款状态为 {string}', async (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('退款处理中');
        await sendMockRefundCallback(
          featureContext.fixtures.values.apiServer,
          context.refundRecord,
          'PROCESSING',
          {},
        );

        const order = await getOrder(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        expect(order.status).toBe('REFUND_PROCESSING');
      });

      When('运营人员再次扫码核销用户的订单核销码', async () => {
        const token = featureContext.operatorToken;
        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Given('微信支付服务通知 cr7 支付服务退款结果，退款成功', async () => {
        await sendMockRefundCallback(
          featureContext.fixtures.values.apiServer,
          context.refundRecord,
          'SUCCESS',
          { successTime: new Date().toISOString() },
        );

        const order = await getOrder(
          featureContext.fixtures.values.apiServer,
          context.order.id,
          featureContext.userToken,
        );
        expect(order.status).toBe('REFUNDED');
      });

      When('运营人员在退款成功后再次扫码核销用户的订单核销码', async () => {
        const token = featureContext.operatorToken;
        try {
          await performRedeem(featureContext, context.redemption, token);
        } catch (error) {
          context.lastError = error;
        }
      });

      Then('退款成功导致的核销失败，状态码为 {int}, 错误信息为 {string}', (_ctx, statusCode: number, message: string) => {
        expect(context.lastError).toBeTruthy();
        assertAPIError(context.lastError, {
          status: statusCode,
          method: 'POST',
          messageIncludes: message,
        });
      });
    },
  );
});
