import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { Exhibition, User } from '@cr7/types';
import { expect, vi } from 'vitest';
import type { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';

import { toDateLabel } from './lib/relative-date.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import { setupWechatFixture, WechatFixture } from './fixtures/wechat.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
} from './fixtures/exhibition.js';
import {
  grantRoleToUser as grantRoleToUserAPI,
  getRoleIdByName as getRoleIdByNameAPI,
} from './fixtures/user.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';

const schema = 'test_cdkey';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/cdkey.feature');

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: Record<string, Exhibition.TicketCategory>;
}

interface UserContext {
  adminToken: string;
  operatorToken: string;
  usersByName: Record<string, { token: string; profile: User.Profile }>;
}

interface FeatureContext extends
  ExhibitionContext,
  UserContext {
  apiServer: Server;
  broker: ServiceBroker;
  wechatFixture: WechatFixture;
};

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
    featureContext.usersByName = {};
    featureContext.wechatFixture = wechatFixture;
  });

  AfterAllScenarios(async () => {
    await featureContext.broker.stop();
    await featureContext.wechatFixture.close();
    await dropSchema({ schema });
  });

  BeforeEachScenario(async () => {
    await migrate({ schema });
  });

  defineSteps(({ Given }) => {
    Given('用户 {string} 已注册并登录，已绑定手机号', async (_ctx, userName: string) => {
      const { apiServer, wechatFixture } = featureContext;
      const { token, profile } = await wechatFixture.registerAndBindPhone(
        apiServer,
        userName,
      );
      featureContext.usersByName[userName] = { token, profile };
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (
      _ctx,
      ticketName: string,
      admittance: number
    ) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
        name: ticketName,
        admittance,
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
      });
      featureContext.ticketByName = { ...ticketByName, [ticketName]: ticket };
    });

    Given('{string} 库存为 2', async (ctx, ticketName: string) => {
      const { ticketByName, apiServer, adminToken, exhibition } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket, `Ticket '${ticket.name}' not found`).toBeTruthy();
      await updateTicketCategoryMaxInventory(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        2,
      );
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

    And('{string} 被授予 "运营" 角色', async (_ctx, userName: string) => {
      const { apiServer, adminToken, usersByName } = featureContext;
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
    });

    Given('默认核销展览活动已创建，开始时间为 "今天"，结束时间为 "3天后"', async () => {
      const { apiServer, adminToken } = featureContext;
      const exhibition = await prepareExhibition(apiServer, adminToken, {
        name: `CD-KEY_${Date.now()}`,
        description: 'cd-key test exhibition',
        start_date: toDateLabel('今天'),
        end_date: toDateLabel('3天后'),
      });
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      expect(sessions.length).toBeGreaterThan(0);
      featureContext.ticketByName = {};
      featureContext.exhibition = exhibition;
      featureContext.sessions = sessions;
    });
  });

  Scenario('管理员创建兑换码批次', ({ Given, When, Then, And }) => {
    Given('管理员填写兑换码批次信息，批次名称为 "测试兑换码"', () => {});
    And('兑换码类型为 "单人票"，兑换码数量为 2', () => {});
    And('兑换码批次兑换有效期到 "3天后"', () => {});
    When('管理员提交兑换码批次创建请求', () => {});
    Then('兑换码批次创建成功', () => {});
    When('管理员查看兑换码批次列表，第 1 页，每页 10 条', () => {});
    Then('兑换码批次列表总数为 1', () => {});
    And('兑换码批次列表中有 1 个批次', () => {});
  });
});
