import { Server } from 'node:http';
import config from 'config';
import { ServiceBroker } from 'moleculer';
import type { MockInstance } from 'vitest';
import { expect, vi } from 'vitest';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { Exhibition } from '@cr7/types';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import {
  prepareExhibition,
  prepareTicketCategory,
  updateExhibition,
} from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { toDateLabel } from './lib/relative-date.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { MockServer } from './lib/server.js';

const schema = 'test_damai';
const services = ['api', 'user', 'cr7', 'damai'];

const feature = await loadFeature('tests/features/damai.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  ticketByName: TicketByName;
}

interface FeatureContext extends ExhibitionContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
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
          price,
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

    And('默认展会活动的城市是 {string}', async (_ctx, cityName: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer, adminToken!,
        exhibition.id, { city: cityName },
      );
    });

    Given('大麦 OTA 服务已启动', () => {
      // todo mock damai ota server
    });
  });

  Scenario('同步展会信息到大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given('cr7 将展会信息同步到大麦', () => {
      // TODO: 实现具体的展会同步逻辑
    });

    When('大麦收到展会同步消息', () => {
      // TODO: 实现大麦接收展会同步消息的验证
    });

    Then('大麦收到请求签名无误', () => {
      // TODO: 实现大麦验证请求的逻辑
    });

    And('展会同步消息中的演出 ID 是默认展会活动的 ID', () => {
      const { exhibition } = featureContext;
      expect(exhibition).toBeTruthy();
      expect(exhibition.id).toBeTruthy();
      // TODO: 补充具体的验证逻辑
    });
  });
});
