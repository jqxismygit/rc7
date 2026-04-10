import config from 'config';
import {
  describeFeature,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { Exhibition, Xiecheng } from '@cr7/types';
import { prepareAPIServer, prepareServices, services_fixtures } from './fixtures/services.js';
import { getUserProfile, prepareAdminToken, registerUser } from './fixtures/user.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
} from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import {
  bindTicketXiechengOptionId,
  listTicketXiechengSyncLogs,
  syncTicketInventoryToXiecheng,
  syncTicketPriceToXiecheng,
} from './fixtures/xiecheng.js';
import { assertAPIError } from './lib/api.js';
import { mockJSONServer, MockServer } from './lib/server.js';
import { toDateLabel } from './lib/relative-date.js';
import { decryptXieChengBody } from '../src/libs/xiecheng.js';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';

const schema = 'test_xiecheng';
const services = ['api', 'user', 'cr7', 'xiecheng'];

const feature = await loadFeature('tests/features/xiecheng.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

interface FeatureContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
  userToken: string;
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: TicketByName;
}

type PendingSyncRequest = {
  ticketName: string;
  serviceName: Xiecheng.XcServiceName;
  startSessionDate: string;
  endSessionDate: string;
  quantity?: number;
};

type XiechengScenarioContext = {
  mockServer?: MockServer;
  baseUrlSpy?: MockInstance;
  latestRequestPayload?: {
    header: {
      accountId: string;
      serviceName: string;
      requestTime: string;
      version: string;
      sign: string;
    };
    body: string;
  };
  latestDecryptedBody?: {
    sequenceId: string;
    otaOptionId: string;
    supplierOptionId: string;
    prices?: Array<{ date: string; salePrice: number; costPrice: number }>;
    inventories?: Array<{ date: string; quantity: number }>;
  };
  pendingSync?: PendingSyncRequest;
  syncLog?: Xiecheng.XcSyncLog;
  syncLogs?: Xiecheng.XcSyncLog[];
  lastError?: unknown;
};

const openedMockServers: MockServer[] = [];
const openedBaseUrlSpies: MockInstance[] = [];

function resetScenarioContext(context: XiechengScenarioContext) {
  context.latestRequestPayload = undefined;
  context.latestDecryptedBody = undefined;
  context.pendingSync = undefined;
  context.syncLog = undefined;
  context.syncLogs = undefined;
  context.lastError = undefined;
}

async function closeScenarioServer(context: XiechengScenarioContext) {
  if (context.baseUrlSpy) {
    context.baseUrlSpy.mockRestore();
    context.baseUrlSpy = undefined;
  }

  if (context.mockServer) {
    await context.mockServer.close();
    context.mockServer = undefined;
  }
}

async function setupXiechengMock(
  context: XiechengScenarioContext,
) {
  await closeScenarioServer(context);

  const mockServer = await mockJSONServer(async ({ body }) => {
    const requestPayload = body as {
      header: {
        accountId: string;
        serviceName: string;
        requestTime: string;
        version: string;
        sign: string;
      };
      body: string;
    };
    context.latestRequestPayload = requestPayload;

    const plainBody = decryptXieChengBody(
      requestPayload.body,
      config.xiecheng.aes_key,
      config.xiecheng.aes_iv,
    );

    context.latestDecryptedBody = JSON.parse(plainBody);

    return {
      header: {
        resultCode: '0000',
        resultMessage: '操作成功',
      }
    };
  });

  context.baseUrlSpy = vi.spyOn(config.xiecheng, 'base_url', 'get').mockReturnValue(mockServer.address);
  context.mockServer = mockServer;
  openedMockServers.push(mockServer);
  openedBaseUrlSpies.push(context.baseUrlSpy);
}

async function executePendingSync(
  featureContext: FeatureContext,
  scenarioContext: XiechengScenarioContext,
) {
  if (!scenarioContext.pendingSync || scenarioContext.syncLog) {
    return;
  }

  const pending = scenarioContext.pendingSync;
  const ticket = featureContext.ticketByName[pending.ticketName];
  expect(ticket, `Ticket '${pending.ticketName}' not found`).toBeTruthy();

  const payload = {
    start_session_date: toDateLabel(pending.startSessionDate),
    end_session_date: toDateLabel(pending.endSessionDate),
  };

  try {
    if (pending.serviceName === 'DatePriceModify') {
      scenarioContext.syncLog = await syncTicketPriceToXiecheng(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        payload,
      );
    } else {
      scenarioContext.syncLog = await syncTicketInventoryToXiecheng(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        {
          ...payload,
          quantity: pending.quantity,
        },
      );
    }
  } catch (error) {
    scenarioContext.lastError = error;
  }
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  Background,
  Scenario,
  context: featureContext,
}) => {

  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    await bootstrap();
    const broker = await prepareServices(services);
    await broker.start();
    featureContext.broker = broker;
    featureContext.apiServer = await prepareAPIServer(broker);
    featureContext.ticketByName = {};
  });

  AfterAllScenarios(async () => {
    for (const server of openedMockServers) {
      await server.close();
    }
    await featureContext.broker.stop();
  });

  AfterEachScenario(async () => {
    await dropSchema({ schema });
    for (const spy of openedBaseUrlSpies) {
      spy.mockRestore();
    }

    for (const [key] of Object.entries(featureContext)) {
      if (['broker', 'apiServer'].includes(key)) {
        continue;
      }
      Object.assign(featureContext, { [key]: undefined });
    }
  });

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });

    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
    });

    Given('用户 {string} 已注册并登录', async (_ctx, userName: string) => {
      const { apiServer } = featureContext;
      featureContext.userToken = await registerUser(apiServer, `${userName}_${Date.now()}`);
      await getUserProfile(apiServer, featureContext.userToken);
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      const { adminToken, apiServer } = featureContext;
      featureContext.exhibition = await prepareExhibition(apiServer, adminToken, {
        name: `XC_${Date.now()}`,
        description: 'xiecheng integration test exhibition',
        start_date: toDateLabel(startDate),
        end_date: toDateLabel(endDate),
      });
      featureContext.sessions = await getSessions(apiServer, featureContext.exhibition.id, adminToken);
      featureContext.ticketByName = {};
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (_ctx, ticketName: string, admittance: number) => {
      const ticket = await prepareTicketCategory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: ticketName,
          admittance,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
        },
      );

      featureContext.ticketByName = {
        ...featureContext.ticketByName,
        [ticketName]: ticket,
      };
    });

    Given('展会添加票种 "单人票", 准入人数为 1, 有效期为场次当天', async () => {
      const ticketName = '单人票';
      const ticket = await prepareTicketCategory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: ticketName,
          admittance: 1,
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
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      await updateTicketCategoryMaxInventory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        quantity,
      );
    });

    And('"单人票" 库存为 2', async () => {
      const ticketName = '单人票';
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      await updateTicketCategoryMaxInventory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        2,
      );
    });
  });

  Scenario('管理员绑定门票到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { When, Then, context } = s;

    When('管理员在 {string} 上添加携程编号 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      resetScenarioContext(context);
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    Then('{string} 的 ota Option Id 被设置为 {string}', (_ctx, ticketName: string, otaOptionId: string) => {
      expect(featureContext.ticketByName[ticketName].ota_xc_option_id).toBe(otaOptionId);
    });
  });

  Scenario('管理员可以将门票的场次及价格同步到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('携程服务已经准备好接收场次价格同步信息', async () => {
      resetScenarioContext(context);
      await setupXiechengMock(context);
    });

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket).toBeTruthy();
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 场次和价格同步给携程', (_ctx, ticketName: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DatePriceModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
      };
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      context.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', async (_ctx, endDate: string) => {
      context.pendingSync!.endSessionDate = endDate;
      await executePendingSync(featureContext, context);
    });

    Then('携程接收到了场次价格同步信息', () => {
      expect(context.latestRequestPayload).toBeTruthy();
      expect(context.latestRequestPayload!.header.serviceName).toBe('DatePriceModify');
    });

    And('可以正确解密', () => {
      expect(context.latestDecryptedBody).toBeTruthy();
    });

    And('包含 {string} 天的场次信息', (_ctx, days: string) => {
      expect(context.latestDecryptedBody?.prices).toHaveLength(Number(days));
    });

    And('同步的场次起始时间为 {string}', (_ctx, dateLabel: string) => {
      const prices = context.latestDecryptedBody?.prices ?? [];
      expect(prices[0].date).toBe(toDateLabel(dateLabel));
    });

    And('同步的场次结束时间为 {string}', (_ctx, dateLabel: string) => {
      const prices = context.latestDecryptedBody?.prices ?? [];
      expect(prices.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('场次中的售价为 {string} 的价格', (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const expected = Number((ticket.price / 100).toFixed(2));
      const prices = context.latestDecryptedBody?.prices ?? [];
      expect(prices.every(item => item.salePrice === expected)).toBe(true);
    });

    And('场次中的成本价为 {string} 的价格', (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const expected = Number((ticket.price / 100).toFixed(2));
      const prices = context.latestDecryptedBody?.prices ?? [];
      expect(prices.every(item => item.costPrice === expected)).toBe(true);
    });

    And('ota Option Id 是 {string} 的携程编号 {string}', (_ctx, ticketName: string, otaOptionId: string) => {
      expect(featureContext.ticketByName[ticketName].ota_xc_option_id).toBe(otaOptionId);
      expect(context.latestDecryptedBody?.otaOptionId).toBe(otaOptionId);
    });

    And('supplier Option Id 是 {string} 的票种 ID', (_ctx, ticketName: string) => {
      expect(context.latestDecryptedBody?.supplierOptionId).toBe(featureContext.ticketByName[ticketName].id);
    });

    And('Service Name 是 {string}', (_ctx, serviceName: string) => {
      expect(context.latestRequestPayload?.header.serviceName).toBe(serviceName);
    });
  });

  Scenario('管理员可以查看门票的场次及价格同步记录', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('携程服务已经准备好接收场次价格同步信息', async () => {
      resetScenarioContext(context);
      await setupXiechengMock(context);
    });

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 场次和价格同步给携程', async (_ctx, ticketName: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DatePriceModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
      };
      await executePendingSync(featureContext, context);
    });

    Then('管理员可以查看 {string} 的携程价格同步记录', async (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      context.syncLogs = await listTicketXiechengSyncLogs(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        'DatePriceModify',
      );
    });

    And('{string} 有 {string} 条携程价格同步记录', (_ctx, _ticketName: string, expectedCount: string) => {
      expect(context.syncLogs).toHaveLength(Number(expectedCount));
    });

    And('同步结果为 {string}', (_ctx, resultText: string) => {
      expect(resultText).toBe('成功');
      expect(context.syncLogs?.[0].status).toBe('SUCCESS');
    });

    And('sequence Id 是同步信息中的 sequence Id', () => {
      expect(context.syncLogs?.[0].sequence_id).toBe(context.syncLog?.sequence_id);
      expect(context.syncLogs?.[0].sequence_id).toBe(context.latestDecryptedBody?.sequenceId);
    });

    And('service Name 是 {string}', (_ctx, serviceName: string) => {
      expect(context.syncLogs?.[0].service_name).toBe(serviceName);
    });

    And('ota Option Id 是 {string} 的携程编号 {string}', (_ctx, ticketName: string, otaOptionId: string) => {
      expect(featureContext.ticketByName[ticketName].ota_xc_option_id).toBe(otaOptionId);
      expect(context.syncLogs?.[0].ota_option_id).toBe(otaOptionId);
    });

    And('场次有 {string} 个', (_ctx, count: string) => {
      expect(context.syncLogs?.[0].sync_items).toHaveLength(Number(count));
    });

    And('起始场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = context.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items[0].date).toBe(toDateLabel(dateLabel));
    });

    And('结束场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = context.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('售价为 {string} 的价格', (_ctx, ticketName: string) => {
      const expected = Number((featureContext.ticketByName[ticketName].price / 100).toFixed(2));
      const items = context.syncLogs?.[0].sync_items as Array<{ sale_price: number }>;
      expect(items.every(item => item.sale_price === expected)).toBe(true);
    });

    And('成本价为 {string} 的价格', (_ctx, ticketName: string) => {
      const expected = Number((featureContext.ticketByName[ticketName].price / 100).toFixed(2));
      const items = context.syncLogs?.[0].sync_items as Array<{ cost_price: number }>;
      expect(items.every(item => item.cost_price === expected)).toBe(true);
    });
  });

  Scenario('不能同步时间不在展会范围内的场次价格信息', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      resetScenarioContext(context);
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 场次和价格同步给携程', (_ctx, ticketName: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DatePriceModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
      };
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      context.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', async (_ctx, endDate: string) => {
      context.pendingSync!.endSessionDate = endDate;
      await executePendingSync(featureContext, context);
    });

    Then('同步失败，错误信息包含 {string}', (_ctx, message: string) => {
      assertAPIError(context.lastError, {
        status: 400,
        messageIncludes: message,
      });
    });
  });

  Scenario('同步场次门票剩余库存到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('携程服务已经准备好接收场次库存同步信息', async () => {
      resetScenarioContext(context);
      await setupXiechengMock(context);
    });

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 剩余库存同步给携程', (_ctx, ticketName: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DateInventoryModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
      };
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      context.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', async (_ctx, endDate: string) => {
      context.pendingSync!.endSessionDate = endDate;
      await executePendingSync(featureContext, context);
    });

    Then('携程接收到了库存同步信息', () => {
      expect(context.latestRequestPayload).toBeTruthy();
      expect(context.latestRequestPayload?.header.serviceName).toBe('DateInventoryModify');
    });

    And('可以正确解密', () => {
      expect(context.latestDecryptedBody).toBeTruthy();
    });

    And('库存数量为 {string} 的剩余库存数量', (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const inventories = context.latestDecryptedBody?.inventories ?? [];
      const defaultInventory = 2;
      expect(ticket).toBeTruthy();
      expect(inventories.every(item => item.quantity === defaultInventory)).toBe(true);
    });

    And('ota Option Id 是 {string} 的携程编号 {string}', (_ctx, _ticketName: string, otaOptionId: string) => {
      expect(context.latestDecryptedBody?.otaOptionId).toBe(otaOptionId);
    });

    And('supplier Option Id 是 {string} 的票种 ID', (_ctx, ticketName: string) => {
      expect(context.latestDecryptedBody?.supplierOptionId).toBe(featureContext.ticketByName[ticketName].id);
    });

    And('Service Name 是 {string}', (_ctx, serviceName: string) => {
      expect(context.latestRequestPayload?.header.serviceName).toBe(serviceName);
    });

    And('同步结果为 {string}', (_ctx, resultText: string) => {
      expect(resultText).toBe('成功');
      expect(context.syncLog?.status).toBe('SUCCESS');
    });

    And('同步的场次起始时间为 {string}', (_ctx, dateLabel: string) => {
      const items = context.syncLog?.sync_items as Array<{ date: string }>;
      expect(items[0].date).toBe(toDateLabel(dateLabel));
    });

    And('同步的场次结束时间为 {string}', (_ctx, dateLabel: string) => {
      const items = context.syncLog?.sync_items as Array<{ date: string }>;
      expect(items.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('每个场次的库存数量为 {string} 的剩余库存数量', (_ctx, _ticketName: string) => {
      const items = context.syncLog?.sync_items as Array<{ quantity: number }>;
      expect(items.every(item => item.quantity === 2)).toBe(true);
    });
  });

  Scenario('同步场次门票指定库存到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('携程服务已经准备好接收场次库存同步信息', async () => {
      resetScenarioContext(context);
      await setupXiechengMock(context);
    });

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 指定库存数量 {string} 同步给携程', (_ctx, ticketName: string, quantityText: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DateInventoryModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
        quantity: Number(quantityText),
      };
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      context.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', async (_ctx, endDate: string) => {
      context.pendingSync!.endSessionDate = endDate;
      await executePendingSync(featureContext, context);
    });

    Then('携程接收到了库存同步信息', () => {
      expect(context.latestRequestPayload).toBeTruthy();
    });

    And('可以正确解密', () => {
      expect(context.latestDecryptedBody).toBeTruthy();
    });

    And('库存数量为 {string}', (_ctx, quantityText: string) => {
      const quantity = Number(quantityText);
      const items = context.latestDecryptedBody?.inventories ?? [];
      expect(items.every(item => item.quantity === quantity)).toBe(true);
    });
  });

  Scenario('管理员可以查看门票的库存同步记录', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('携程服务已经准备好接收场次库存同步信息', async () => {
      resetScenarioContext(context);
      await setupXiechengMock(context);
    });

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 剩余库存同步给携程', async (_ctx, ticketName: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DateInventoryModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
      };
      await executePendingSync(featureContext, context);
    });

    Then('管理员可以查看 {string} 的携程库存同步记录', async (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      context.syncLogs = await listTicketXiechengSyncLogs(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        'DateInventoryModify',
      );
    });

    And('{string} 有 {string} 条携程库存同步记录', (_ctx, _ticketName: string, expectedCount: string) => {
      expect(context.syncLogs).toHaveLength(Number(expectedCount));
    });

    And('同步结果为 {string}', (_ctx, resultText: string) => {
      expect(resultText).toBe('成功');
      expect(context.syncLogs?.[0].status).toBe('SUCCESS');
    });

    And('sequence Id 是同步信息中的 sequence Id', () => {
      expect(context.syncLogs?.[0].sequence_id).toBe(context.syncLog?.sequence_id);
      expect(context.syncLogs?.[0].sequence_id).toBe(context.latestDecryptedBody?.sequenceId);
    });

    And('service Name 是 {string}', (_ctx, serviceName: string) => {
      expect(context.syncLogs?.[0].service_name).toBe(serviceName);
    });

    And('ota Option Id 是 {string} 的携程编号 {string}', (_ctx, _ticketName: string, otaOptionId: string) => {
      expect(context.syncLogs?.[0].ota_option_id).toBe(otaOptionId);
    });

    And('场次有 {string} 个', (_ctx, count: string) => {
      expect(context.syncLogs?.[0].sync_items).toHaveLength(Number(count));
    });

    And('起始场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = context.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items[0].date).toBe(toDateLabel(dateLabel));
    });

    And('结束场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = context.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('每个场次的库存数量为 {string} 的剩余库存数量', (_ctx, _ticketName: string) => {
      const items = context.syncLogs?.[0].sync_items as Array<{ quantity: number }>;
      expect(items.every(item => item.quantity === 2)).toBe(true);
    });
  });

  Scenario('不能同步时间不在展会范围内的库存信息', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      resetScenarioContext(context);
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 剩余库存同步给携程', (_ctx, ticketName: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DateInventoryModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
      };
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      context.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', async (_ctx, endDate: string) => {
      context.pendingSync!.endSessionDate = endDate;
      await executePendingSync(featureContext, context);
    });

    Then('同步失败，错误信息包含 {string}', (_ctx, message: string) => {
      assertAPIError(context.lastError, {
        status: 400,
        messageIncludes: message,
      });
    });
  });

  Scenario('不能同步库存数量超过实际剩余库存的库存信息', (s: StepTest<XiechengScenarioContext>) => {
    const { Given, When, Then, And, context } = s;

    Given('{string} 的携程编号是 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
      resetScenarioContext(context);
      const ticket = featureContext.ticketByName[ticketName];
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        otaOptionId,
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    When('管理员将 {string} 指定库存数量 {string} 同步给携程', (_ctx, ticketName: string, quantityText: string) => {
      context.pendingSync = {
        ticketName,
        serviceName: 'DateInventoryModify',
        startSessionDate: '今天',
        endSessionDate: '2天后',
        quantity: Number(quantityText),
      };
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      context.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', async (_ctx, endDate: string) => {
      context.pendingSync!.endSessionDate = endDate;
      await executePendingSync(featureContext, context);
    });

    Then('同步失败，错误信息包含 {string}', (_ctx, message: string) => {
      assertAPIError(context.lastError, {
        status: 400,
        messageIncludes: message,
      });
    });
  });
});
