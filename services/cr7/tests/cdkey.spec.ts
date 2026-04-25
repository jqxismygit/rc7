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

interface FeatureContext extends ExhibitionContext, UserContext {
  apiServer: Server;
  broker: ServiceBroker;
  wechatFixture: WechatFixture;
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

  defineSteps(({ Given, When, Then, And }) => {
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
      admittance: number,
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

    Given('{string} 库存为 {int}', async (_ctx, ticketName: string, inventory: number) => {
      const { ticketByName, apiServer, adminToken, exhibition } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
      await updateTicketCategoryMaxInventory(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        inventory,
      );
    });

    // create cd-keys
    Given('管理员填写兑换码批次信息，批次名称为 {string}', async (_ctx, batchName: string) => {
      void batchName;
    });

    And('兑换码类型为 {string}, 可以兑换 {int} 张', async (_ctx, ticketName: string, count: number) => {
      void ticketName;
      void count;
    });

    And('兑换码类型为 {string}，可以兑换 {int} 张', async (_ctx, ticketName: string, count: number) => {
      void ticketName;
      void count;
    });

    And('兑换码数量为 {int}', async (_ctx, quantity: number) => {
      void quantity;
    });

    And('兑换码批次兑换有效期到 {string}', async (_ctx, expiry: string) => {
      void expiry;
    });

    When('管理员提交兑换码批次创建请求', async () => {
    });

    Then('兑换码批次创建成功', async () => {
    });

    // list cd-key batches
    When('管理员第 {int} 次查看兑换码批次列表，第 {int} 页，每页 {int} 条', async (
      _ctx,
      viewIndex: number,
      page: number,
      pageSize: number,
    ) => {
      void viewIndex;
      void page;
      void pageSize;
    });

    Then('第 {int} 次查看兑换码批次列表总数为 {int}', async (_ctx, viewIndex: number, total: number) => {
      void viewIndex;
      void total;
    });

    And('第 {int} 次查看兑换码批次列表中有 {int} 个批次', async (
      _ctx,
      viewIndex: number,
      count: number,
    ) => {
      void viewIndex;
      void count;
    });

    // list cd-keys in batch
    When('管理员第 {int} 次查看兑换码批次 {string} 兑换码列表，第 {int} 页，每页 {int} 条', async (
      _ctx,
      viewIndex: number,
      batchName: string,
      page: number,
      pageSize: number,
    ) => {
      void viewIndex;
      void batchName;
      void page;
      void pageSize;
    });

    Then('第 {int} 次查看兑换码列表总数为 {int}', async (_ctx, viewIndex: number, total: number) => {
      void viewIndex;
      void total;
    });

    And('第 {int} 次查看兑换码列表中有 {int} 个兑换码', async (_ctx, viewIndex: number, count: number) => {
      void viewIndex;
      void count;
    });

    And('第 {int} 次查看兑换码列表的兑换有效期为 {string}', async (
      _ctx,
      viewIndex: number,
      expiry: string,
    ) => {
      void viewIndex;
      void expiry;
    });

    And('第 {int} 次查看兑换码列表的场次信息为 null', async (_ctx, viewIndex: number) => {
      void viewIndex;
    });

    And('第 {int} 次查看兑换码列表的兑换人为 null', async (_ctx, viewIndex: number) => {
      void viewIndex;
    });

    And('第 {int} 次查看兑换码列表的核销时间为 null', async (_ctx, viewIndex: number) => {
      void viewIndex;
    });

    // view cd-key details
    When('管理员第 {int} 次查看第 {int} 个兑换码的详情', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中兑换码状态为未使用', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中兑换码状态为已使用', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中兑换有效期为 3天后', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中场次信息为 null', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中核销时间为 null', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中兑换人为 null', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中场次信息为 {string}', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
      sessionDate: string,
    ) => {
      void viewIndex;
      void codeIndex;
      void sessionDate;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中核销时间为核销时间', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
    ) => {
      void viewIndex;
      void codeIndex;
    });

    And('第 {int} 次查看时第 {int} 个兑换码详情中兑换人为 {string}', async (
      _ctx,
      viewIndex: number,
      codeIndex: number,
      userName: string,
    ) => {
      void viewIndex;
      void codeIndex;
      void userName;
    });

    // redeem cd-key
    When('用户 {string} 第 {int} 次使用第 {int} 个兑换码兑换场次为 {string} 的票', async (
      _ctx,
      userName: string,
      useIndex: number,
      codeIndex: number,
      sessionDate: string,
      ticketName: string,
    ) => {
      void userName;
      void useIndex;
      void codeIndex;
      void sessionDate;
      void ticketName;
    });

    Then('兑换成功', async () => {
    });

    // list my redemptions
    When('用户 {string} 查看自己的核销码列表，第 {int} 页，每页 {int} 条', async (
      _ctx,
      userName: string,
      page: number,
      pageSize: number,
    ) => {
      void userName;
      void page;
      void pageSize;
    });

    Then('核销码列表总数为 {int}', async (_ctx, total: number) => {
      void total;
    });

    And('核销码列表中有 {int} 个核销码', async (_ctx, count: number) => {
      void count;
    });

    And('核销码的订单信息为 null', async () => {
    });

    And('核销码的兑换码为第 {int} 个兑换码', async (_ctx, codeIndex: number) => {
      void codeIndex;
    });

    Then('场次 {string} 的 {string} 库存为 {int}', async (
      _ctx,
      sessionDate: string,
      ticketName: string,
      inventory: number,
    ) => {
      void sessionDate;
      void ticketName;
      void inventory;
    });

    // redeem
    When('运营人员将用户 {string} 的订单核销码扫码核销', async (_ctx, userName: string) => {
      void userName;
    });

    Then('核销成功', async () => {
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

  Scenario('管理员创建兑换码批次', ({ And }) => {
    And('兑换码的长度为 "12" 位', () => {
    });
    And('兑换码的第一位是 "C" 先做保留字', () => {
    });
    And('兑换码最后两位是 Luhn 校验码且正确', () => {
    });
    And('兑换码中间的9位字符集 "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" 组成, 不包含易混淆的字符如 "0", "1", "I", "O"', () => {
    });
  });

  Scenario('通过兑换码兑换核销码', ({ When, Then, And }) => {
    When('用户 "Alice" 查看自己的核销码列表，第 1 页，每页 10 条', () => {
    });
    Then('核销码列表总数为 1', () => {
    });
    And('核销码列表中有 1 个核销码', () => {
    });
    And('核销码的订单信息为 null', () => {
    });
    And('核销码的兑换码为第 1 个兑换码', () => {
    });

    And('第 {int} 次查看兑换码批次列表中有 {int} 个批次', () => {
    });

    And('第 {int} 次查看兑换码列表中有 {int} 个兑换码', () => {
    });
  });
});
