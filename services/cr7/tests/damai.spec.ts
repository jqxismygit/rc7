import { Server } from 'node:http';
import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
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
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
  updateExhibition,
} from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { syncExhibitionToDamai, syncSessionsToDamai } from './fixtures/damai.js';
import { toDateLabel } from './lib/relative-date.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { MockServer, mockJSONServer } from './lib/server.js';
import { verifyDamaiSignature } from '@/libs/damai.js';

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
  damaiRequestHandler?: ReturnType<typeof vi.fn>;
}

interface DamaiSignedPayload {
  timestamp: string;
  signInfo: string;
}

interface DamaiHeadPayload {
  version: string;
  msgId: string;
  apiKey: string;
  apiSecret: string;
  timestamp: string;
  signed: string;
}

interface DamaiProjectSyncPayload {
  projectInfo: {
    id: string;
    name: string;
    chooseSeatFlag: boolean;
    posters: string | null;
    introduce: string;
  };
  venueInfo: {
    id: string;
    name: string;
  };
  signed: DamaiSignedPayload;
  head: DamaiHeadPayload;
}

interface DamaiPerform {
  id: string;
  performName: string;
  status: number;
  saleStartTime: string;
  saleEndTime: string;
  showTime: string;
  endTime: string;
  ticketTypeAndDeliveryMethod: Record<string, number[]>;
  ruleType: number;
}

interface DamaiPerformSyncPayload {
  projectId: string;
  performs: DamaiPerform[];
  signed: DamaiSignedPayload;
  head: DamaiHeadPayload;
}

interface DamaiMockRequest {
  body: DamaiProjectSyncPayload | DamaiPerformSyncPayload;
  query: Record<string, string>;
  path: string;
  method: string;
  headers: Record<string, string>;
}

function toDateValue(value: string | Date): Date {
  if (isDate(value)) {
    return value;
  }

  return parseISO(value);
}

function toDateOnlyLabel(value: string | Date): string {
  const parsed = toDateValue(value);
  return format(parsed, 'yyyy-MM-dd');
}

function normalizeTimeLabel(time: string): string {
  const secondPrecision = parse(time, 'HH:mm:ss', new Date());
  if (!Number.isNaN(secondPrecision.getTime()) && format(secondPrecision, 'HH:mm:ss') === time) {
    return time;
  }

  const minutePrecision = parse(time, 'HH:mm', new Date());
  if (!Number.isNaN(minutePrecision.getTime()) && format(minutePrecision, 'HH:mm') === time) {
    return format(minutePrecision, 'HH:mm:ss');
  }

  return time;
}

function formatDamaiSessionDateTime(sessionDate: string | Date, time: string, pattern: 'HH:mm' | 'HH:mm:ss'): string {
  const label = `${toDateOnlyLabel(sessionDate)} ${normalizeTimeLabel(time)}`;
  const parsed = parse(label, 'yyyy-MM-dd HH:mm:ss', new Date());
  return format(parsed, `yyyy-MM-dd ${pattern}`);
}

function getDamaiRequestArg(mock: ReturnType<typeof vi.fn> | undefined): DamaiMockRequest {
  expect(mock).toHaveBeenCalled();
  const [request] = mock!.mock.calls.at(-1) ?? [];
  expect(request).toBeTruthy();
  return request as DamaiMockRequest;
}

async function setupDamaiMockServer(requestHandler: ReturnType<typeof vi.fn>) {
  return mockJSONServer(async (request) => {
    await (requestHandler as unknown as (data: unknown) => unknown)(request);
    return { code: '0', desc: '成功' };
  });
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


    And('默认展会活动的开放时间为 {string}', async (_ctx, openingTime: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        adminToken,
        exhibition.id,
        { opening_time: openingTime },
      );
    });

    And('默认展会活动的闭馆时间为 {string}', async (_ctx, closingTime: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        adminToken,
        exhibition.id,
        { closing_time: closingTime },
      );
    });

    And('默认展会活动的最晚入场时间为 {string}', async (_ctx, lastEntryTime: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        adminToken,
        exhibition.id,
        { last_entry_time: lastEntryTime },
      );
    });

    And('默认展会活动的城市是 {string}', async (_ctx, cityName: string) => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer, adminToken!,
        exhibition.id, { city: cityName },
      );
    });

    Given('大麦 OTA 服务已启动', async () => {
      const damaiRequestHandler = vi.fn();
      const mockDamaiServer = await setupDamaiMockServer(damaiRequestHandler);
      const baseUrlSpy = vi.spyOn(config.damai, 'base_url', 'get').mockReturnValue(mockDamaiServer.address);

      openedMockServers.push(mockDamaiServer);
      openedSpies.push(baseUrlSpy);
      featureContext.damaiRequestHandler = damaiRequestHandler;
    });
  });

  Scenario('同步展会信息到大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given('cr7 将展会信息同步到大麦', async () => {
      await syncExhibitionToDamai(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('大麦收到展会同步消息', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      expect(request.path).toBe('/b2b2c/2.0/sync/project');
      expect(request.method).toBe('POST');
    });

    Then('大麦收到请求签名无误', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { signed, head } = request.body;

      expect(signed.timestamp).toBe(head.timestamp);
      expect(head.signed).toBe(signed.signInfo);
      expect(verifyDamaiSignature(signed.signInfo, {
        apiKey: head.apiKey,
        apiSecret: head.apiSecret,
        msgId: head.msgId,
        timestamp: head.timestamp,
        version: head.version,
      })).toBe(true);
    });

    And('展会同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.id).toBe(exhibition.id);
    });

    And('展会同步消息中的项目名称是默认展会活动的名称', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.name).toBe(exhibition.name);
    });

    And('展会同步消息中的座位信息是无座', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.chooseSeatFlag).toBe(false);
    });

    And('展会同步消息中的海报 URL 是默认展会活动的封面 URL', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.posters).toBe(exhibition.cover_url ?? null);
    });

    And('展会同步消息中的介绍信息是默认展会活动的描述信息', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.projectInfo.introduce).toBe(exhibition.description);
    });

    And('展会同步消息中的展馆 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.venueInfo.id).toBe(exhibition.id);
    });

    And('展会同步消息中的展馆名称是默认展会活动的展馆名称', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const { exhibition } = featureContext;
      const body = request.body as DamaiProjectSyncPayload;
      expect(body.venueInfo.name).toBe(exhibition.venue_name);
    });
  });

  Scenario('同步场次信息到大麦', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given('cr7 将场次信息同步到大麦', async () => {
      await syncSessionsToDamai(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('大麦收到场次同步消息', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      expect(request.path).toBe('/b2b2c/2.0/sync/perform');
      expect(request.method).toBe('POST');
    });

    Then('大麦收到请求签名无误', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const { signed, head } = body;

      expect(signed.timestamp).toBe(head.timestamp);
      expect(head.signed).toBe(signed.signInfo);
      expect(verifyDamaiSignature(signed.signInfo, {
        apiKey: head.apiKey,
        apiSecret: head.apiSecret,
        msgId: head.msgId,
        timestamp: head.timestamp,
        version: head.version,
      })).toBe(true);
    });

    And('场次同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      expect(body.projectId).toBe(featureContext.exhibition.id);
    });

    And('场次同步消息中有 {int} 个场次信息', (_ctx, count: number) => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      expect(body.performs).toHaveLength(count);
    });

    And('场次同步消息中每个场次的 ID 是默认展会活动对应场次的 ID', async () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );

      const expectedIds = sessions.map(session => session.id).sort();
      const actualIds = body.performs.map(perform => perform.id).sort();
      expect(actualIds).toEqual(expectedIds);
    });

    And('场次同步消息中每个场次的名称都是展会的日期', async () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const expectedBySessionId = new Map(
        sessions.map(session => [session.id, format(toDateValue(session.session_date), 'yyyy-MM-dd')]),
      );

      body.performs.forEach(perform => {
        expect(perform.performName).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的销售开始时间都是展会创建时间，格式为 {string}', (_ctx, expectedFormat: string) => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const { exhibition } = featureContext;
      const expected = format(toDateValue(exhibition.created_at), expectedFormat);

      body.performs.forEach(perform => {
        expect(perform.saleStartTime).toBe(expected);
      });
    });

    And('场次同步消息中每个场次的销售结束时间是场次日期的最晚入场时间', async () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          formatDamaiSessionDateTime(session.session_date, exhibition.last_entry_time, 'HH:mm'),
        ]),
      );

      body.performs.forEach(perform => {
        expect(perform.saleEndTime).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的场次演出开始时间是展会场次日期的场次开始时间', async () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          formatDamaiSessionDateTime(session.session_date, exhibition.opening_time, 'HH:mm'),
        ]),
      );

      body.performs.forEach(perform => {
        expect(perform.showTime).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的场次演出结束时间是展会场次日期的结束时间', async () => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;
      const { apiServer, exhibition, adminToken } = featureContext;
      const sessions = await getSessions(apiServer, exhibition.id, adminToken);

      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          formatDamaiSessionDateTime(session.session_date, exhibition.closing_time, 'HH:mm'),
        ]),
      );

      body.performs.forEach(perform => {
        expect(perform.endTime).toBe(expectedBySessionId.get(perform.id));
      });
    });

    And('场次同步消息中每个场次的场次的取票方式是电子票，值为 {int}', (_ctx, ticketType: number) => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;

      body.performs.forEach(perform => {
        expect(perform.ticketTypeAndDeliveryMethod[String(ticketType)]).toEqual([ticketType]);
      });
    });

    And('场次的同步消息中每个场次的认证方式都是非实名制，值为 {int}', (_ctx, ruleType: number) => {
      const request = getDamaiRequestArg(featureContext.damaiRequestHandler);
      const body = request.body as DamaiPerformSyncPayload;

      body.performs.forEach(perform => {
        expect(perform.ruleType).toBe(ruleType);
      });
    });
  });


});
