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
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';

import { Text2Date, toDateLabel } from './lib/relative-date.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import { setupWechatFixture, WechatFixture } from './fixtures/wechat.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
} from './fixtures/exhibition.js';
import { createOrder as createOrderByApi } from './fixtures/order.js';
import {
  getOrderRedemption,
  isValidRedemptionCodeLuhn,
  listMyRedemptions,
  redeemCode,
} from './fixtures/redeem.js';
import {
  grantRoleToUser as grantRoleToUserAPI,
  getRoleIdByName as getRoleIdByNameAPI,
} from './fixtures/user.js';
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

type RedemptionListContext = {
  paidOrders: Order.OrderWithItems[];
  redemptionList: Redeem.RedemptionCodeListResult;
};

type RefundContext = {
  refundRecord: Payment.RefundRecord;
};

type ErrorContext = {
  lastErrorPromise: Promise<unknown>;
};

interface DefaultUserContext {
  adminToken: string;
  userToken: string;
  userProfile: User.Profile;
  operatorToken: string;
  operatorProfile: User.Profile;
  usersByName: Record<string, { token: string; profile: User.Profile }>;
}

interface FeatureContext extends
  DefaultUserContext,
  ExhibitionContext {
  wechatFixture: WechatFixture;
  broker: ServiceBroker;
  apiServer: Server;
  currentOrder?: Order.OrderWithItems;
  redemption?: Redeem.RedemptionCodeWithOrder;
}

interface ServiceWithPool {
  pool: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  };
}

function getSessionByDate(
  sessions: Exhibition.Session[],
  dateLabel: string,
): Exhibition.Session {
  const targetDate = Text2Date(dateLabel);
  const session = sessions.find(item => isSameDay(item.session_date, targetDate));
  expect(session, `Session for ${dateLabel} (${targetDate}) not found`).toBeTruthy();
  return session!;
}

async function createOrderForCurrentUser(
  featureContext: FeatureContext,
  sessionDate: string,
  ticketName: string,
  quantity: number,
): Promise<Order.OrderWithItems> {
  const { exhibition, sessions, ticketByName, userToken, apiServer } = featureContext;
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
  const { exhibition, apiServer } = featureContext;
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
  const { userProfile, userToken, apiServer } = featureContext;
  await markOrderAsPaidForTest(apiServer, userToken, order, userProfile.openid!);
}

async function expireRedemptionForOrder(
  featureContext: FeatureContext,
  orderId: string,
): Promise<void> {
  const { broker } = featureContext;
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
  BeforeEachScenario,
  Background,
  Scenario,
  defineSteps,
  context: featureContext,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    const wechatFixture = await setupWechatFixture();
    await bootstrap();
    const broker = await prepareServices(services);
    await broker.start();
    const apiServer = await prepareAPIServer(broker);

    featureContext.broker = broker;
    featureContext.apiServer = apiServer;
    featureContext.wechatFixture = wechatFixture;
    featureContext.usersByName = {};
  });

  AfterAllScenarios(async () => {
    await featureContext.broker.stop();
    await featureContext.wechatFixture.close();
    await dropSchema({ schema });
  });

  BeforeEachScenario(async () => {
    await migrate({ schema });
  });

  defineSteps(({ Given, When, Then }) => {
    Given(
      '用户预订 {int} 张该展会的 {string} 场次的 {string}',
      async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
        featureContext.currentOrder = await createOrderForCurrentUser(
          featureContext,
          sessionDate,
          ticketName,
          quantity,
        );
      },
    );

    Given('用户 {string} 已注册并登录，已绑定手机号', async (_ctx, userName: string) => {
      const { apiServer, wechatFixture } = featureContext;
      const { token, profile } = await wechatFixture
        .registerAndBindPhone(apiServer, `${userName}_${Date.now()}`);
      featureContext.userToken = token;
      featureContext.userProfile = profile;
      featureContext.usersByName[userName] = { token, profile };
    });

    Given(
      '该展会追加了一个 {string} 票种, 退票策略是 {string}',
      async (_ctx, ticketName: string, policyLabel: string) => {
        const policy = policyLabel.includes('48') ? 'REFUNDABLE_48H_BEFORE' : 'NON_REFUNDABLE';
        const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
        const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
          name: ticketName,
          refund_policy: policy,
          admittance: 1,
          valid_duration_days: 1,
        });
        featureContext.ticketByName = { ...ticketByName, [ticketName]: ticket };
      }
    );

    Given(
      '{string} 库存为 {int}',
      async (_ctx: unknown, ticketName: string, maxInventory: number) => {
        const { ticketByName, apiServer, adminToken, exhibition } = featureContext;
        const ticket = ticketByName[ticketName];
        expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
        await updateTicketCategoryMaxInventory(
          apiServer, adminToken, exhibition.id, ticket.id, maxInventory
        );
      }
    );

    When('用户完成支付', async () => {
      const { currentOrder } = featureContext;
      await payOrderForCurrentUser(featureContext, currentOrder!);
    });

    Then('用户有一个有效的核销码', async () => {
      const { currentOrder, apiServer, userToken } = featureContext;
      const redemption = await getOrderRedemption(
        apiServer,
        currentOrder!.id,
        userToken,
      );
      expect(redemption?.status).toBe('UNREDEEMED');
      featureContext.redemption = redemption;
    });
  });

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });

    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema); ;
    });

    And('{string} 被授予 {string} 角色', async (_ctx, userName: string, roleLabel: string) => {
      const { apiServer, adminToken, usersByName } = featureContext;
      expect(roleLabel).toBe('运营');
      const user = usersByName[userName];
      expect(user).toBeTruthy();
      const operatorRoleId = await getRoleIdByNameAPI(
        apiServer,
        adminToken,
        'OPERATOR',
      );
      await grantRoleToUserAPI(
        apiServer,
        adminToken,
        user.profile.id,
        operatorRoleId,
      );

      featureContext.operatorToken = user.token;
      featureContext.operatorProfile = user.profile;
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      const { apiServer, adminToken } = featureContext;
      const exhibition = await prepareExhibition(apiServer, adminToken, {
        name: `CR7_${Date.now()}`,
        description: 'redeem test exhibition',
        start_date: toDateLabel(startDate),
        end_date: toDateLabel(endDate),
      });
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      expect(sessions.length).toBeGreaterThan(0);
      featureContext.ticketByName = {};
      featureContext.exhibition = exhibition;
      featureContext.sessions = sessions;
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (_ctx, ticketName: string, admittance: number) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
        name: ticketName,
        admittance,
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
      });
      featureContext.ticketByName = { ...ticketByName, [ticketName]: ticket };
    });
  });

  Scenario(
    '一个完成支付的订单拥有一个核销码',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { And, When, Then } = s;

      When('用户查询订单核销信息', async () => {
        const { currentOrder } = featureContext;
        const { apiServer, userToken } = featureContext;
        featureContext.redemption = await getOrderRedemption(
          apiServer,
          currentOrder!.id,
          userToken,
        );
      });

      Then('订单详情中包含一个核销码', () => {
        const { currentOrder, redemption } = featureContext;
        expect(redemption!.order_id).toBe(currentOrder!.id);
      });

      And('核销码的长度为 {string} 位', (_ctx, length: string) => {
        const { redemption } = featureContext;
        expect(redemption!.code).toHaveLength(Number(length));
      });

      And('核销码的第一位是 {string} 先做保留字', (_ctx, prefix: string) => {
        const { redemption } = featureContext;
        expect(redemption!.code.startsWith(prefix)).toBe(true);
      });

      And('核销码最后两位是 Luhn 校验码且正确', () => {
        const { redemption } = featureContext;
        expect(isValidRedemptionCodeLuhn(redemption!.code)).toBe(true);
      });

      And(
        '核销码中间的9位字符集 {string} 组成, 不包含易混淆的字符如 {string}, {string}, {string}, {string}',
        (_ctx, charset: string, c1: string, c2: string, c3: string, c4: string) => {
          const { redemption } = featureContext;
          const middle = redemption!.code.slice(1, 10);
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
        const { redemption } = featureContext;
        expect(redemption!.status).toBe('UNREDEEMED');
        expect(redemption!.redeemed_at).toBeNull();
        expect(redemption!.redeemed_by).toBeNull();
      });

      And('核销码下有两张 {string} 票', (_ctx, ticketName: string) => {
        const { redemption } = featureContext;
        expect(redemption!.items).toHaveLength(1);
        expect(redemption!.items[0].category_name).toBe(ticketName);
        expect(redemption!.items[0].quantity).toBe(2);
      });

      And('核销码的准入人数为 {string}', (_ctx, quantity: string) => {
        const { redemption } = featureContext;
        expect(redemption!.quantity).toBe(Number(quantity));
      });

      And('核销码关联订单的场次日期为 {string}', (_ctx, sessionDate: string) => {
        const { redemption } = featureContext;
        expect(redemption!.session.session_date).toBe(toDateLabel(sessionDate));
      });

      And('核销码关联订单的来源为 {string}', (_ctx, source: string) => {
        const { redemption } = featureContext;
        expect(redemption!.order.source).toBe(source);
      });

      And('核销码的有效期为场次当天', () => {
        const { redemption } = featureContext;
        const validFrom = new Date(redemption!.valid_from);
        const validUntil = new Date(redemption!.valid_until);
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
    '用户可以分页查询自己的核销码列表并按状态筛选',
    (s: StepTest<RedemptionListContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('用户已完成 {int} 个订单支付用于核销码列表查询', async (_ctx, count: number) => {
        const total = count;
        context.paidOrders = [];

        for (let index = 0; index < total; index += 1) {
          const order = await createOrderForCurrentUser(
            featureContext,
            '今天',
            'early_bird',
            1,
          );
          await payOrderForCurrentUser(featureContext, order);
          context.paidOrders.push(order);
        }
      });

      When('用户查询自己的核销码列表，第 {int} 页，每页 {int} 条', async (_ctx, page: number, limit: number) => {
        const { apiServer, userToken } = featureContext;
        context.redemptionList = await listMyRedemptions(
          apiServer,
          userToken,
          { page, limit },
        );
      });

      Then('核销码列表总数为 {int}', (_ctx, total: number) => {
        expect(context.redemptionList.total).toBe(total);
      });

      And('核销码列表当前页为 {int}', (_ctx, page: number) => {
        expect(context.redemptionList.page).toBe(page);
      });

      And('核销码列表每页数量为 {int}', (_ctx, limit: number) => {
        expect(context.redemptionList.limit).toBe(limit);
      });

      And('核销码列表返回 {int} 条记录', (_ctx, count: number) => {
        expect(context.redemptionList.redemptions).toHaveLength(count);
      });

      Given('运营人员核销用户 {string} 的第 {int} 个订单核销码', async (_ctx, userName: string, index: number) => {
        const { usersByName, apiServer, userToken, operatorToken } = featureContext;
        expect(usersByName[userName]).toBeTruthy();

        const order = context.paidOrders[index - 1];
        expect(order).toBeTruthy();

        const redemption = await getOrderRedemption(
          apiServer,
          order.id,
          userToken,
        );

        await performRedeem(featureContext, redemption, operatorToken);
      });

      When(
        '用户按状态 {string} 查询自己的核销码列表，第 {int} 页，每页 {int} 条',
        async (_ctx, status: Redeem.RedemptionStatus, page: number, limit: number) => {
          const { apiServer, userToken } = featureContext;
          context.redemptionList = await listMyRedemptions(
            apiServer,
            userToken,
            { status, page, limit },
          );
        });

      Then('按状态筛选的核销码列表总数为 {int}', (_ctx, total: number) => {
        expect(context.redemptionList.total).toBe(total);
      });

      And('按状态筛选的核销码列表返回 {int} 条记录', (_ctx, count: number) => {
        expect(context.redemptionList.redemptions).toHaveLength(count);
      });

      And('按状态筛选结果中的订单 ID 与第 {int} 个订单一致', (_ctx, index: number) => {
        const order = context.paidOrders[index - 1];
        expect(order).toBeTruthy();
        expect(context.redemptionList.redemptions[0].order_id).toBe(order.id);
      });

      And('按状态筛选结果中的订单场次日期为 {string}', (_ctx, sessionDate: string) => {
        expect(context.redemptionList.redemptions[0].session.session_date).toBe(toDateLabel(sessionDate));
      });
    },
  );

  Scenario(
    '使用核销码完成订单核销',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { And, When, Then } = s;

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        const { usersByName, operatorToken, redemption } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        featureContext.redemption = await performRedeem(
          featureContext,
          redemption!,
          operatorToken,
        );
      });

      Then('核销成功', () => {
        const { redemption } = featureContext;
        expect(redemption?.status).toBe('REDEEMED');
      });

      And('核销码状态变为 {string}', (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('已核销');
        const { redemption } = featureContext;
        expect(redemption?.status).toBe('REDEEMED');
      });

      And('核销码的核销时间被记录', () => {
        const { redemption } = featureContext;
        expect(redemption?.redeemed_at).toBeTruthy();
      });

      And('核销码的核销人为运营人员', () => {
        const { redemption, operatorProfile } = featureContext;
        const operatorId = operatorProfile.id;
        expect(redemption?.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '一个未完成支付的订单没有核销码',
    (s: StepTest<OrderContext & ErrorContext>) => {
      const { And, When, Then, context } = s;

      When('用户查询订单核销信息', async () => {
        const { currentOrder, apiServer, userToken } = featureContext;
        context.lastErrorPromise = getOrderRedemption(
          apiServer,
          currentOrder!.id,
          userToken,
        );
      });

      Then('操作失败，状态码为 {int}', async (_ctx, statusCode: number) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ status: statusCode });
      });

      And('错误类型为 {string}', async (_ctx, errorType: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ body: { type: errorType } });
      });
    },
  );

  Scenario(
    '已过期订单的核销码不可用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, And, When, Then, context } = s;

      Given('核销码已过期', async () => {
        const { currentOrder } = featureContext;
        await expireRedemptionForOrder(featureContext, currentOrder!.id);
      });

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        const { usersByName, operatorToken, redemption } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        context.lastErrorPromise = performRedeem(featureContext, redemption!, operatorToken);
      });

      Then('操作失败，状态码为 {int}', async (_ctx, statusCode: number) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ status: statusCode });
      });

      And('错误类型为 {string}', async (_ctx, errorType: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ body: { type: errorType } });
      });
    },
  );

  Scenario(
    '未生效订单的核销码不可用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { And, When, Then, context } = s;

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        const { usersByName, operatorToken, redemption } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        context.lastErrorPromise = performRedeem(featureContext, redemption!, operatorToken);
      });

      Then('操作失败，状态码为 {int}', async (_ctx, statusCode: number) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ status: statusCode });
      });

      And('错误类型为 {string}', async (_ctx, errorType: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ body: { type: errorType } });
      });
    },
  );

  Scenario(
    '已核销订单的核销码不可重复使用',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { And, When, Then, context } = s;

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        const { usersByName, redemption, operatorToken } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        featureContext.redemption = await performRedeem(
          featureContext,
          redemption!,
          operatorToken,
        );
      });

      Then('核销成功', () => {
        const { redemption } = featureContext;
        expect(redemption?.status).toBe('REDEEMED');
      });

      When('运营人员再次将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        const { usersByName, operatorToken, redemption } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        context.lastErrorPromise = performRedeem(featureContext, redemption!, operatorToken);
      });

      Then('操作失败，状态码为 {int}', async (_ctx, statusCode: number) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ status: statusCode });
      });

      And('错误类型为 {string}', async (_ctx, errorType: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ body: { type: errorType } });
      });
    },
  );

  Scenario(
    '只有运营人员才能核销',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { And, When, Then, context } = s;

      When('用户 "Alice" 尝试核销用户 {string} 的订单核销码', async (_ctx, userName: string) => {
        const { usersByName, redemption } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        const token = usersByName.Alice.token;
        context.lastErrorPromise = performRedeem(featureContext, redemption!, token);
      });

      Then('操作失败，状态码为 {int}', async (_ctx, statusCode: number) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ status: statusCode });
      });

      And('错误类型为 {string}', async (_ctx, errorType: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ body: { type: errorType } });
      });

      When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
        const { usersByName, redemption, operatorToken } = featureContext;
        expect(usersByName[userName]).toBeTruthy();
        featureContext.redemption = await performRedeem(
          featureContext,
          redemption!,
          operatorToken,
        );
      });

      Then('核销成功', () => {
        const { redemption } = featureContext;
        expect(redemption?.status).toBe('REDEEMED');
      });

      And('核销码的核销人为 "运营人员"', () => {
        const { operatorProfile, redemption } = featureContext;
        const operatorId = operatorProfile.id;
        expect(redemption?.redeemed_by).toBe(operatorId);
      });
    },
  );

  Scenario(
    '当天场次的核销码从今天零点起有效',
    (s: StepTest<OrderContext & RedemptionContext & ErrorContext>) => {
      const { And } = s;

      And('核销码的有效期起始时间不晚于当前时间', () => {
        const { redemption } = featureContext;
        // Regression test: valid_from must be local midnight, not UTC midnight.
        // If toValidityStartDate used Date.UTC(), valid_from in UTC+8 would be 8 hours in the
        // future, making the code appear expired immediately after purchase.
        const validFrom = new Date(redemption!.valid_from);
        expect(validFrom.getTime()).toBeLessThanOrEqual(Date.now());
        // Explicit: valid_from must be exactly today's local midnight (00:00:00.000)
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        expect(validFrom.getTime()).toBe(todayMidnight.getTime());
      });

      And('运营人员将用户 "Alice" 的订单核销码立即扫码核销成功', async () => {
        const { redemption, operatorToken } = featureContext;
        await expect(
          performRedeem(featureContext, redemption!, operatorToken),
        ).resolves.to.toMatchObject({
          status: 'REDEEMED',
        });
      });
    },
  );

  Scenario(
    '已经核销的订单不能发起退款',
    (s: StepTest<ExhibitionContext & OrderContext & RedemptionContext & ErrorContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('订单已被核销', async () => {
        const { redemption, operatorToken } = featureContext;
        featureContext.redemption = await performRedeem(
          featureContext,
          redemption!,
          operatorToken,
        );
      });

      When('用户发起退款请求', async () => {
        const { apiServer, userToken, currentOrder } = featureContext;
        context.lastErrorPromise = requestRefundWithMock(
          apiServer,
          currentOrder!,
          userToken,
        );
      });

      Then('操作失败，状态码为 {int}', async (_ctx, statusCode: number) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({ status: statusCode });
      });

      And('错误信息包含 {string}', async (_ctx, message: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({
          message: expect.stringContaining(message),
        });
      });

      And('订单状态仍然为 {string}', async (_ctx, statusLabel: string) => {
        const { currentOrder, apiServer, userToken } = featureContext;
        const order = await getOrder(
          apiServer,
          currentOrder!.id,
          userToken,
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
      const { Given, When, Then, context } = s;

      Given('用户已发起退款请求，订单状态为 {string}', async (_ctx, statusLabel: string) => {
        expect(statusLabel).toBe('退款已受理');
        const { currentOrder, apiServer, userToken } = featureContext;
        const { refundRecord } = await requestRefundWithMock(
          apiServer,
          currentOrder!,
          userToken,
        );
        context.refundRecord = refundRecord;

        const order = await getOrder(
          apiServer,
          currentOrder!.id,
          userToken,
        );
        expect(order.status).toBe('REFUND_REQUESTED');
      });

      When('运营人员扫码核销用户的订单核销码', async () => {
        const { redemption, operatorToken } = featureContext;
        context.lastErrorPromise = performRedeem(featureContext, redemption!, operatorToken);
      });

      Then('核销失败，状态码为 {int}, 错误信息为 {string}', async (_ctx, statusCode: number, message: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({
          status: statusCode,
          message: expect.stringContaining(message),
        });
      });

      Then('退款处理中导致再次核销失败，状态码为 {int}, 错误信息为 {string}', async (_ctx, statusCode: number, message: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({
          status: statusCode,
          message: expect.stringContaining(message),
        });
      });

      Given('微信支付服务通知 cr7 支付服务退款状态为 {string}', async (_ctx, statusLabel: string) => {
        const { refundRecord } = context;
        const { apiServer, currentOrder, userToken } = featureContext;
        expect(statusLabel).toBe('退款处理中');
        await sendMockRefundCallback(
          apiServer,
          refundRecord,
          'PROCESSING',
          {},
        );

        const order = await getOrder(
          apiServer,
          currentOrder!.id,
          userToken,
        );
        expect(order.status).toBe('REFUND_PROCESSING');
      });

      When('运营人员再次扫码核销用户的订单核销码', async () => {
        const { redemption, operatorToken } = featureContext;
        context.lastErrorPromise = performRedeem(featureContext, redemption!, operatorToken);
      });

      Given('微信支付服务通知 cr7 支付服务退款结果，退款成功', async () => {
        const { apiServer, userToken, currentOrder } = featureContext;
        const { refundRecord } = context;
        await sendMockRefundCallback(
          apiServer,
          refundRecord,
          'SUCCESS',
          { successTime: new Date().toISOString() },
        );

        const order = await getOrder(
          apiServer,
          currentOrder!.id,
          userToken,
        );
        expect(order.status).toBe('REFUNDED');
      });

      When('运营人员在退款成功后再次扫码核销用户的订单核销码', async () => {
        const { redemption, operatorToken } = featureContext;
        context.lastErrorPromise = performRedeem(featureContext, redemption!, operatorToken);
      });

      Then('退款成功导致的核销失败，状态码为 {int}, 错误信息为 {string}', async (_ctx, statusCode: number, message: string) => {
        await expect(context.lastErrorPromise).rejects.toMatchObject({
          status: statusCode,
          message: expect.stringContaining(message),
        });
      });
    },
  );
});
