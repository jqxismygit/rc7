import config from 'config';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { expect, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { Exhibition, Xiecheng } from '@cr7/types';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
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

interface XiechengServer {
  xiechengReqHandler: MockInstance;
}

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: TicketByName;
}

interface UserContext {
  adminToken: string;
  userToken: string;
}

interface DatePriceContext {
  ticket: Exhibition.TicketCategory;
  start_session_date: string;
  end_session_date: string;
}

interface FeatureContext extends
  UserContext,
  ExhibitionContext,
  Partial<XiechengServer> {
  broker: ServiceBroker;
  apiServer: Server;
  datePrice: DatePriceContext;
  pendingSync?: PendingSyncRequest;
  syncLog?: Xiecheng.XcSyncLog;
  syncLogs?: Xiecheng.XcSyncLog[];
  lastError?: unknown;
  latestRequestPayload?: XiechengRequestPayload;
  latestDecryptedBody?: SessionPriceReqBody | SessionInventoryReqBody;
}

interface PendingSyncRequest {
  ticketName: string;
  serviceName: Xiecheng.XcServiceName;
  startSessionDate: string;
  endSessionDate: string;
  quantity?: number;
};

interface SessionPriceReqBody {
  sequenceId: string;
  prices: Array<{
    date: string;
    salePrice: number;
    costPrice: number;
  }>;
  otaOptionId: string;
  supplierOptionId: string;
}

interface SessionInventoryReqBody {
  sequenceId: string;
  inventories: Array<{
    date: string;
    quantity: number;
  }>;
  otaOptionId: string;
  supplierOptionId: string;
}

interface XiechengRequestPayload {
  header: {
    accountId: string;
    serviceName: string;
    requestTime: string;
    version: string;
    sign: string;
  };
  body: string;
}

interface XiechengScenarioContext {
  pendingSync?: PendingSyncRequest;
  syncLog?: Xiecheng.XcSyncLog;
  syncLogs?: Xiecheng.XcSyncLog[];
  lastError?: unknown;
  latestRequestPayload?: XiechengRequestPayload;
  latestDecryptedBody?: SessionPriceReqBody | SessionInventoryReqBody;
}

const openedMockServers: MockServer[] = [];
const openedBaseUrlSpies: MockInstance[] = [];

function getLatestXiechengRequestPayload(featureContext: FeatureContext): XiechengRequestPayload {
  const { xiechengReqHandler } = featureContext;
  expect(xiechengReqHandler).toBeTruthy();
  expect(xiechengReqHandler).toHaveBeenCalled();
  const latestCallArg = xiechengReqHandler!.mock.calls.at(-1)?.[0];
  expect(latestCallArg).toBeTruthy();
  return latestCallArg.body as XiechengRequestPayload;
}

function captureLatestDecryptedBody(featureContext: FeatureContext) {
  const payload = getLatestXiechengRequestPayload(featureContext);
  featureContext.latestRequestPayload = payload;

  const { xiecheng } = config;
  const decrypted = decryptXieChengBody(payload.body, xiecheng.aes_key, xiecheng.aes_iv);
  featureContext.latestDecryptedBody = JSON.parse(decrypted);
}

function toOtaOptionId(ticketName: string) {
  if (ticketName === '早鸟票') {
    return 'xc_early_bird';
  }

  if (ticketName === '单人票') {
    return 'xc_single_ticket';
  }

  return `xc_${ticketName}`;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  Background,
  defineSteps,
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

  defineSteps(({ Given, And, When }) => {
    Given('携程服务已经准备好接受同步信息', async () => {
      const xiechengReqHandler = vi.fn()
      .mockResolvedValueOnce({
        header: { resultCode: '0000', resultMessage: '操作成功' }
      });
      const mockServer = await mockJSONServer(xiechengReqHandler);

      const baseUrlSpy = vi
      .spyOn(config.xiecheng, 'base_url', 'get')
      .mockReturnValue(mockServer.address);

      openedMockServers.push(mockServer);
      openedBaseUrlSpies.push(baseUrlSpy);

      featureContext.xiechengReqHandler = xiechengReqHandler;
    });

    Given(
      '展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天, 价格是 {int} 元',
      async (_ctx, ticketName: string, admittance: number, price: number) => {
      const ticket = await prepareTicketCategory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: ticketName,
          price: price * 100,
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

    Given(
      '当前同步类型为场次价格, 票种 {string}，场次开始时间为 {string}，结束时间为 {string}',
      (_ctx, ticketName: string, startDate: string, endDate: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
      featureContext.datePrice = {
        ticket,
        start_session_date: toDateLabel(startDate),
        end_session_date: toDateLabel(endDate),
      };
    });

    Given('当前同步类型为剩余库存', () => {
      featureContext.pendingSync = {
        ticketName: featureContext.pendingSync?.ticketName ?? '',
        serviceName: 'DateInventoryModify',
        startSessionDate: featureContext.pendingSync?.startSessionDate ?? '今天',
        endSessionDate: featureContext.pendingSync?.endSessionDate ?? '2天后',
      };
    });

    Given('当前同步类型为指定库存', () => {
      featureContext.pendingSync = {
        ticketName: featureContext.pendingSync?.ticketName ?? '',
        serviceName: 'DateInventoryModify',
        startSessionDate: featureContext.pendingSync?.startSessionDate ?? '今天',
        endSessionDate: featureContext.pendingSync?.endSessionDate ?? '2天后',
        quantity: featureContext.pendingSync?.quantity ?? 1,
      };
    });

    And('指定库存数量为 {string}', (_ctx, quantityText: string) => {
      expect(featureContext.pendingSync).toBeTruthy();
      featureContext.pendingSync!.quantity = Number(quantityText);
    });

    Given('票种 {string}，场次开始时间为 {string}，结束时间为 {string}', async (_ctx, ticketName: string, startDate: string, endDate: string) => {
      featureContext.pendingSync = {
        ticketName,
        serviceName: featureContext.pendingSync?.serviceName ?? 'DatePriceModify',
        startSessionDate: startDate,
        endSessionDate: endDate,
        quantity: featureContext.pendingSync?.quantity,
      };

      const ticket = featureContext.ticketByName[ticketName];
      expect(ticket, `Ticket '${ticketName}' not found`).toBeTruthy();
      const updated = await bindTicketXiechengOptionId(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        toOtaOptionId(ticketName),
      );
      featureContext.ticketByName[ticketName] = updated;
    });

    And('场次起始时间为 {string}', (_ctx, startDate: string) => {
      expect(featureContext.pendingSync).toBeTruthy();
      featureContext.pendingSync!.startSessionDate = startDate;
    });

    And('场次结束时间为 {string}', (_ctx, endDate: string) => {
      expect(featureContext.pendingSync).toBeTruthy();
      featureContext.pendingSync!.endSessionDate = endDate;
    });

    When('管理员将场次票种同步给携程', async () => {
      const { apiServer, adminToken, exhibition, datePrice } = featureContext;
      const { ticket, start_session_date, end_session_date } = datePrice;

      try {
        featureContext.syncLog = await syncTicketPriceToXiecheng(
          apiServer, adminToken, exhibition.id, ticket.id,
          { start_session_date, end_session_date },
        );
      } catch (error) {
        featureContext.lastError = error;
      }
    });

    When('管理员将场次票种的库存同步给携程', async () => {
      expect(featureContext.pendingSync).toBeTruthy();
      const pending = featureContext.pendingSync!;
      const ticket = featureContext.ticketByName[pending.ticketName];
      expect(ticket, `Ticket '${pending.ticketName}' not found`).toBeTruthy();

      const payload = {
        start_session_date: toDateLabel(pending.startSessionDate),
        end_session_date: toDateLabel(pending.endSessionDate),
      };

      try {
        featureContext.syncLog = await syncTicketInventoryToXiecheng(
          featureContext.apiServer,
          featureContext.adminToken,
          featureContext.exhibition.id,
          ticket.id,
          {
            ...payload,
            quantity: pending.quantity,
          },
        );
      } catch (error) {
        featureContext.lastError = error;
      }
    })
  });

  Background(({ Given }) => {
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
        name: 'XC_Exhibition',
        description: 'xiecheng integration test exhibition',
        start_date: toDateLabel(startDate),
        end_date: toDateLabel(endDate),
      });
      featureContext.sessions = await getSessions(apiServer, featureContext.exhibition.id, adminToken);
      featureContext.ticketByName = {};
    });
  });

  Scenario('管理员绑定门票到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { When, Then } = s;

    When('管理员在 {string} 上添加携程编号 {string}', async (_ctx, ticketName: string, otaOptionId: string) => {
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

  Scenario('管理员可以将门票的场次及价格同步到携程', (s: StepTest<
    XiechengScenarioContext
    & { decryptedBody: SessionPriceReqBody; }
  >) => {
    const { Then, And, context } = s;

    Then('携程接收到了场次价格同步信息', () => {
      const { xiechengReqHandler } = featureContext;
      expect(xiechengReqHandler).toHaveBeenCalledTimes(1);
      expect(xiechengReqHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: "POST",
          path: "/api/product/price.do",
        })
      );
    });

    And('可以正确解密', () => {
      captureLatestDecryptedBody(featureContext);
      context.decryptedBody = featureContext.latestDecryptedBody as SessionPriceReqBody;
    });

    And('包含 {string} 天的场次信息', (_ctx, days: string) => {
      const { decryptedBody } = context;
      expect(decryptedBody.prices).toHaveLength(Number(days));
    });

    And('同步的场次起始时间为 {string}', (_ctx, dateLabel: string) => {
      const prices = context.decryptedBody.prices;
      expect(prices[0].date).toBe(toDateLabel(dateLabel));
    });

    And('同步的场次结束时间为 {string}', (_ctx, dateLabel: string) => {
      const prices = context.decryptedBody.prices;
      expect(prices.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And(
      '售价为 {string} 元, 成本价为 {string} 元',
      (_ctx, salePrice: string, costPrice: string) => {
      for (const price of context.decryptedBody.prices) {
        expect(price.salePrice).toEqual(salePrice);
        expect(price.costPrice).toEqual(costPrice);
      }
    });

    And('supplier Option Id 是 {string} 的票种 ID', (_ctx, ticketName: string) => {
      expect(context.decryptedBody.supplierOptionId).toBe(featureContext.ticketByName[ticketName].id);
    });

    And('Service Name 是 {string}', (_ctx, serviceName: string) => {
      const { xiechengReqHandler } = featureContext;
      expect(xiechengReqHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            header: expect.objectContaining({
              serviceName: serviceName,
            }),
          }),
        })
      );
    });
  });

  Scenario('管理员可以查看门票的场次及价格同步记录', (s: StepTest<XiechengScenarioContext>) => {
    const { Then, And } = s;

    Then('管理员可以查看 {string} 的携程价格同步记录', async (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      featureContext.syncLogs = await listTicketXiechengSyncLogs(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        'DatePriceModify',
      );
    });

    And('{string} 有 {string} 条携程价格同步记录', (_ctx, _ticketName: string, expectedCount: string) => {
      expect(featureContext.syncLogs).toHaveLength(Number(expectedCount));
    });

    And('同步结果为 {string}', (_ctx, resultText: string) => {
      expect(resultText).toBe('成功');
      expect(featureContext.syncLogs?.[0].status).toBe('SUCCESS');
    });

    And('sequence Id 是同步信息中的 sequence Id', () => {
      captureLatestDecryptedBody(featureContext);
      expect(featureContext.syncLogs?.[0].sequence_id).toBe(featureContext.syncLog?.sequence_id);
      expect(featureContext.syncLogs?.[0].sequence_id).toBe(featureContext.latestDecryptedBody?.sequenceId);
    });

    And('service Name 是 {string}', (_ctx, serviceName: string) => {
      expect(featureContext.syncLogs?.[0].service_name).toBe(serviceName);
    });

    And('场次有 {string} 个', (_ctx, count: string) => {
      expect(featureContext.syncLogs?.[0].sync_items).toHaveLength(Number(count));
    });

    And('起始场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = featureContext.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items[0].date).toBe(toDateLabel(dateLabel));
    });

    And('结束场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = featureContext.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('售价为 {string} 元, 成本价为 {string} 元', (_ctx, salePrice: string, costPrice: string) => {
      const item = (featureContext.syncLogs?.[0].sync_items as Array<{ sale_price: string; cost_price: string }>)[0];
      expect(item.sale_price).toEqual(salePrice);
      expect(item.cost_price).toEqual(costPrice);
    });
  });

  Scenario('不能同步时间不在展会范围内的场次价格信息', (s: StepTest<XiechengScenarioContext>) => {
    const { Then } = s;

    Then('同步失败，错误信息包含 {string}', (_ctx, message: string) => {
      assertAPIError(featureContext.lastError, {
        status: 400,
        messageIncludes: message,
      });
    });
  });

  Scenario('同步场次门票剩余库存到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { Then, And } = s;

    Then('携程接收到了库存同步信息', () => {
      const { xiechengReqHandler } = featureContext;
      expect(xiechengReqHandler).toHaveBeenCalledTimes(1);
      expect(xiechengReqHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/product/stock.do',
        })
      );
    });

    And('可以正确解密', () => {
      captureLatestDecryptedBody(featureContext);
      expect(featureContext.latestDecryptedBody).toBeTruthy();
    });

    And('库存数量为 {string} 的剩余库存数量', (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const inventories = (featureContext.latestDecryptedBody as SessionInventoryReqBody | undefined)?.inventories ?? [];
      const defaultInventory = 2;
      expect(ticket).toBeTruthy();
      expect(inventories.every(item => item.quantity === defaultInventory)).toBe(true);
    });

    And('ota Option Id 是 {string} 的携程编号 {string}', (_ctx, _ticketName: string, otaOptionId: string) => {
      expect((featureContext.latestDecryptedBody as SessionInventoryReqBody | undefined)?.otaOptionId).toBe(otaOptionId);
    });

    And('supplier Option Id 是 {string} 的票种 ID', (_ctx, ticketName: string) => {
      expect((featureContext.latestDecryptedBody as SessionInventoryReqBody | undefined)?.supplierOptionId).toBe(featureContext.ticketByName[ticketName].id);
    });

    And('Service Name 是 {string}', (_ctx, serviceName: string) => {
      const { xiechengReqHandler } = featureContext;
      expect(xiechengReqHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            header: expect.objectContaining({
              serviceName,
            }),
          }),
        })
      );
    });

    And('同步结果为 {string}', (_ctx, resultText: string) => {
      expect(resultText).toBe('成功');
      expect(featureContext.syncLog?.status).toBe('SUCCESS');
    });

    And('同步的场次起始时间为 {string}', (_ctx, dateLabel: string) => {
      const items = featureContext.syncLog?.sync_items as Array<{ date: string }>;
      expect(items[0].date).toBe(toDateLabel(dateLabel));
    });

    And('同步的场次结束时间为 {string}', (_ctx, dateLabel: string) => {
      const items = featureContext.syncLog?.sync_items as Array<{ date: string }>;
      expect(items.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('每个场次的库存数量为 {string} 的剩余库存数量', (_ctx, _ticketName: string) => {
      const items = featureContext.syncLog?.sync_items as Array<{ quantity: number }>;
      expect(items.every(item => item.quantity === 2)).toBe(true);
    });
  });

  Scenario('同步场次门票指定库存到携程', (s: StepTest<XiechengScenarioContext>) => {
    const { Then, And } = s;

    Then('携程接收到了库存同步信息', () => {
      const { xiechengReqHandler } = featureContext;
      expect(xiechengReqHandler).toHaveBeenCalledTimes(1);
      expect(xiechengReqHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/product/stock.do',
        })
      );
    });

    And('可以正确解密', () => {
      captureLatestDecryptedBody(featureContext);
      expect(featureContext.latestDecryptedBody).toBeTruthy();
    });

    And('库存数量为 {string}', (_ctx, quantityText: string) => {
      const quantity = Number(quantityText);
      const items = (featureContext.latestDecryptedBody as SessionInventoryReqBody | undefined)?.inventories ?? [];
      expect(items.every(item => item.quantity === quantity)).toBe(true);
    });
  });

  Scenario('管理员可以查看门票的库存同步记录', (s: StepTest<XiechengScenarioContext>) => {
    const { Then, And } = s;

    Then('管理员可以查看 {string} 的携程库存同步记录', async (_ctx, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      featureContext.syncLogs = await listTicketXiechengSyncLogs(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        'DateInventoryModify',
      );
    });

    And('{string} 有 {string} 条携程库存同步记录', (_ctx, _ticketName: string, expectedCount: string) => {
      expect(featureContext.syncLogs).toHaveLength(Number(expectedCount));
    });

    And('同步结果为 {string}', (_ctx, resultText: string) => {
      expect(resultText).toBe('成功');
      expect(featureContext.syncLogs?.[0].status).toBe('SUCCESS');
    });

    And('sequence Id 是同步信息中的 sequence Id', () => {
      captureLatestDecryptedBody(featureContext);
      expect(featureContext.syncLogs?.[0].sequence_id).toBe(featureContext.syncLog?.sequence_id);
      expect(featureContext.syncLogs?.[0].sequence_id).toBe(featureContext.latestDecryptedBody?.sequenceId);
    });

    And('service Name 是 {string}', (_ctx, serviceName: string) => {
      expect(featureContext.syncLogs?.[0].service_name).toBe(serviceName);
    });

    And('ota Option Id 是 {string} 的携程编号 {string}', (_ctx, _ticketName: string, otaOptionId: string) => {
      expect(featureContext.syncLogs?.[0].ota_option_id).toBe(otaOptionId);
    });

    And('场次有 {string} 个', (_ctx, count: string) => {
      expect(featureContext.syncLogs?.[0].sync_items).toHaveLength(Number(count));
    });

    And('起始场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = featureContext.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items[0].date).toBe(toDateLabel(dateLabel));
    });

    And('结束场次时间为 {string}', (_ctx, dateLabel: string) => {
      const items = featureContext.syncLogs?.[0].sync_items as Array<{ date: string }>;
      expect(items.at(-1)?.date).toBe(toDateLabel(dateLabel));
    });

    And('每个场次的库存数量为 {string} 的剩余库存数量', (_ctx, _ticketName: string) => {
      const items = featureContext.syncLogs?.[0].sync_items as Array<{ quantity: number }>;
      expect(items.every(item => item.quantity === 2)).toBe(true);
    });
  });

  Scenario('不能同步时间不在展会范围内的库存信息', (s: StepTest<XiechengScenarioContext>) => {
    const { Then } = s;

    Then('同步失败，错误信息包含 {string}', (_ctx, message: string) => {
      assertAPIError(featureContext.lastError, {
        status: 400,
        messageIncludes: message,
      });
    });
  });

  Scenario('不能同步库存数量超过实际剩余库存的库存信息', (s: StepTest<XiechengScenarioContext>) => {
    const { Then } = s;

    Then('同步失败，错误信息包含 {string}', (_ctx, message: string) => {
      assertAPIError(featureContext.lastError, {
        status: 400,
        messageIncludes: message,
      });
    });
  });
});
