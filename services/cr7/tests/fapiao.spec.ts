import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { Server } from 'node:http';
import config from 'config';
import { isSameDay } from 'date-fns';
import { ServiceBroker } from 'moleculer';
import { expect, vi } from 'vitest';
import { Exhibition, Order, User } from '@cr7/types';
import { Text2Date, toDateLabel } from './lib/relative-date.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import { setupWechatFixture, WechatFixture } from './fixtures/wechat.js';
import { getSessions, prepareExhibition, prepareTicketCategory } from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { createOrder, getOrder } from './fixtures/order.js';
import { markOrderAsPaidForTest } from './fixtures/payment.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';

const schema = 'test_fapiao';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/fapiao.feature');

type ExhibitionContext = {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: Record<string, Exhibition.TicketCategory>;
};

type OrderContext = {
  order: Order.OrderWithItems;
};

interface FeatureContext extends ExhibitionContext, OrderContext {
  broker: ServiceBroker;
  apiServer: Server;
  wechatFixture: WechatFixture;
  adminToken: string;
  userToken: string;
  userProfile: User.Profile;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  Background,
  Scenario,
  context: featureContext,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    await bootstrap();
    const broker = await prepareServices(services);
    await broker.start();
    featureContext.broker = broker;
    featureContext.apiServer = await prepareAPIServer(broker);
    featureContext.wechatFixture = await setupWechatFixture();
    featureContext.ticketByName = {};
  });

  AfterAllScenarios(async () => {
    if (featureContext.broker) {
      await featureContext.broker.stop();
    }
    await featureContext.wechatFixture.close();
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
      featureContext.adminToken = await prepareAdminToken(
        featureContext.apiServer,
        schema,
      );
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      featureContext.exhibition = await prepareExhibition(
        featureContext.apiServer,
        featureContext.adminToken,
        {
          name: `fapiao_${Date.now()}`,
          description: 'fapiao test exhibition',
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

    Given(
      '展会添加票种 {string}, 准入人数为 {number}, 有效期为场次当天, 价格是 {number} 元',
      async (_ctx, ticketName: string, admittance: number, priceYuan: number) => {
      const ticket = await prepareTicketCategory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: ticketName,
          admittance,
          valid_duration_days: 1,
          price: priceYuan * 100,
          refund_policy: 'NON_REFUNDABLE',
        },
      );
      featureContext.ticketByName[ticketName] = ticket;
    });

    And('票种 {string} 库存为 {number}', async (_ctx, ticketName: string, inventory: number) => {
      const ticket = featureContext.ticketByName[ticketName];
      await updateTicketCategoryMaxInventory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        inventory,
      );
    });

    Given('用户已经通过微信绑定手机号，手机号为 {string}，国别码为 {string}', async (_ctx, phone: string, countryCode: string) => {
      const { token, profile } = await featureContext.wechatFixture.registerAndBindPhone(
        featureContext.apiServer,
        `fapiao_user_${Date.now()}`,
        {
          phone,
          countryCode,
        },
      );

      featureContext.userToken = token;
      featureContext.userProfile = profile;
    });

    And('用户预订 {int} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const session = featureContext.sessions.find(item => isSameDay(item.session_date, Text2Date(sessionDate)))!;

      featureContext.order = await createOrder(
        featureContext.apiServer,
        featureContext.exhibition.id,
        session.id,
        [{ ticket_category_id: ticket.id, quantity }],
        featureContext.userToken,
      );
    });


    And('用户发起并完成微信支付', async () => {
      await markOrderAsPaidForTest(
        featureContext.apiServer,
        featureContext.userToken,
        featureContext.order!,
        featureContext.userProfile.openid!,
      );
      featureContext.order = await getOrder(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.userToken,
      );
    });

    And('订单状态为已支付', () => {
      expect(featureContext.order!.status).toBe('PAID');
    });
  });

  Scenario('用户成功申请发票', (s: StepTest<OrderContext>) => {
    const { Then } = s;

    Then('订单已具备申请发票的数据条件', () => {
      expect(featureContext.order).toBeTruthy();
      expect(featureContext.order!.status).toBe('PAID');
      expect(featureContext.order!.items.length).toBeGreaterThan(0);
      expect(featureContext.order!.total_amount).toBeGreaterThan(0);
      expect(featureContext.userProfile.phone).toContain('12345678901');
    });
  });
});
