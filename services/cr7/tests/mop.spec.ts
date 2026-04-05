import { Server } from 'node:http';
import config from 'config';
import { ServiceBroker } from 'moleculer';
import type { Mock, MockInstance } from 'vitest';
import { expect, vi } from 'vitest';
import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { format, isDate, parse, parseISO } from 'date-fns';
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
import {
  setupMopMockServer,
  syncExhibitionToMop,
  syncSessionsToMop,
  SyncSessionsToMopRequest,
} from './fixtures/mop.js';
import { toDateLabel } from './lib/relative-date.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { MockServer } from './lib/server.js';

const schema = 'test_mop';
const services = ['api', 'user', 'cr7', 'mop'];

const feature = await loadFeature('tests/features/mop.feature');

type TicketByName = Record<string, Exhibition.TicketCategory>;

type DecryptedMoeSyncRequest = {
  cityId: string;
  cityName: string;
  otProjectId: string;
  category: number;
  otVenueId: string;
  otVenueName: string;
  projectStatus: number;
  name: string;
};

type MopShow = SyncSessionsToMopRequest['shows'][number];

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

function toSessionDateLabel(value: Date | string): string {
  const dateValue = isDate(value) ? value : parseISO(value);
  if (Number.isNaN(dateValue.getTime())) {
    return String(value).slice(0, 10);
  }

  return format(dateValue, 'yyyy-MM-dd');
}

function getMopRequestArg(mockHandler: Mock) {
  expect(mockHandler).toHaveBeenCalled();
  const call = mockHandler.mock.calls.at(-1);
  expect(call).toBeDefined();
  return call?.[0] as { uri: string; body: unknown };
}

const DATETIME_LABEL_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

interface MopServerContext {
  mopRequestHandler: Mock<
  (request: { uri: string; body: unknown }) => Promise<{ code: number; msg: string; body?: unknown }>
  >;
}

interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  ticketByName: TicketByName;
}

interface FeatureContext extends
  ExhibitionContext,
  MopServerContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
}

const CITY_BY_NAME: Record<string, { id: string; name: string }> = {
  上海: {
    id: '310000',
    name: '上海市',
  },
};

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
  });

  defineSteps(({ And, Then }) => {
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

    Then('猫眼收到请求可以正常解密，签名无误', () => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.anything(),
        uri: expect.anything()
      }));
    });
  })

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema})
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
          name: `MOE_${Date.now()}`,
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
      const city = CITY_BY_NAME[cityName];
      expect(city).toBeTruthy();
      const { apiServer } = featureContext;
      featureContext.exhibition = await updateExhibition(
        apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        { city: cityName },
      );
    });

    Given('展会添加票种 {string}, 准入人数为 {int}, 有效期为场次当天', async (
      _ctx,
      ticketName: string,
      admittance: number,
    ) => {
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
      const ticket = await prepareTicketCategory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        {
          name: '单人票',
          admittance: 1,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
        },
      );

      featureContext.ticketByName = {
        ...featureContext.ticketByName,
        单人票: ticket,
      };
    });

    Given('猫眼 OTA 已启动', async () => {
      const mopRequestHandler = vi.fn().mockResolvedValue({
        code: 10000,
        msg: '成功'
      });
      const mockMopServer = await setupMopMockServer(mopRequestHandler);
      const baseUrlSpy = vi.spyOn(config.mop, 'base_url', 'get').mockReturnValue(mockMopServer.address);
      openedMockServers.push(mockMopServer);
      openedSpies.push(baseUrlSpy);
      featureContext.mopRequestHandler = mopRequestHandler;
    });
  });

  Scenario('同步展会信息到猫眼', (s: StepTest<void>) => {
    const { Given, When, Then, And } = s;

    Given('cr7 将展会信息同步到猫眼', async () => {
      await syncExhibitionToMop(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('猫眼收到展会同步消息', () => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalled();
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        uri: '/supply/open/mop/project/push'
      }));
    });

    And('展会同步消息中的演出 ID 是默认展会活动的 ID', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          otProjectId: exhibition.id,
        }),
      }));
    });

    And('展会同步消息中的城市 id 是展会所在城市的 ID', () => {
      const { exhibition, mopRequestHandler } = featureContext;
      const city = CITY_BY_NAME[exhibition.city];
      expect(city).toBeTruthy();
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          cityId: city.id,
        }),
      }));
    });

    And('展会同步消息中的城市名称是展会所在城市的名称', () => {
      const { exhibition, mopRequestHandler } = featureContext;
      const city = CITY_BY_NAME[exhibition.city];
      expect(city).toBeTruthy();
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          cityName: city.name,
        }),
      }));
    });

    And(
      '展会同步消息中的类目是 {string}, 值为 {int}',
      (_ctx, categoryName: string, categoryValue: number) => {
      const { mopRequestHandler } = featureContext;
      expect(categoryName).toBe('休闲展览');
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          category: categoryValue,
        }),
      }));
    });

    And('展会中的场馆 ID 是展会 ID', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          otVenueId: exhibition.id,
        }),
      }));
    });

    And('展会中的场馆名称是展会场馆名称', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          otVenueName: exhibition.venue_name,
        }),
      }));
    });

    And('展会中的项目状态是有效，值为 {int}', (_ctx, status: number) => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          projectStatus: status,
        }),
      }));
    });

    And('展会同步消息中的展会名称是默认展会活动的名称', () => {
      const { mopRequestHandler, exhibition } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.objectContaining({
          name: exhibition.name,
        }),
      }));
    });
  });

  Scenario('同步场次信息到猫眼', (s: StepTest<void>) => {
    const { Given, When, And } = s;

    Given('cr7 将场次信息同步到猫眼', async () => {
      await syncSessionsToMop(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
      );
    });

    When('猫眼收到场次同步消息', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      expect(request.uri).toBe('/supply/open/mop/show/push');
    });

    And('场次同步消息中的项目 ID 是默认展会活动的 ID', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      expect(body.otProjectId).toBe(featureContext.exhibition.id);
    });

    And('场次同步消息中有 {int} 个场次', (_ctx, count: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      expect(body.shows).toHaveLength(count);
    });

    And('场次同步消息中的首个场次日期与展会开始日期一致', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const exhibitionStartDate = toSessionDateLabel(featureContext.exhibition.start_date);
      expect(body.shows[0].startTime.startsWith(exhibitionStartDate)).toBe(true);
    });

    And('场次同步消息中的最后一个场次日期与展会结束日期一致', () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const lastShow = body.shows.at(-1);
      expect(lastShow).toBeTruthy();
      const exhibitionEndDate = toSessionDateLabel(featureContext.exhibition.end_date);
      expect(lastShow?.startTime.startsWith(exhibitionEndDate)).toBe(true);
    });

    And('场次同步消息中每个场次的 ID 是 cr7 场次 ID', async () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedIds = sessions.map(session => session.id).sort();
      const actualIds = body.shows.map(show => show.otShowId).sort();
      expect(actualIds).toEqual(expectedIds);
    });

    And('场次同步消息中每个场次的状态是有效，值为 {int}', (_ctx, status: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach(show => {
        expect(show.otShowStatus).toBe(status);
      });
    });

    And('场次同步消息中每个场次的开始时间是 cr7 场次的日期和开始时间的组合', async () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedTime = normalizeTimeLabel(featureContext.exhibition.opening_time);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          `${toSessionDateLabel(session.session_date)} ${expectedTime}`,
        ])
      );

      body.shows.forEach(show => {
        expect(show.startTime).toMatch(DATETIME_LABEL_RE);
        expect(show.startTime).toBe(expectedBySessionId.get(show.otShowId));
      });
    });

    And('场次同步消息中每个场次的结束时间是 cr7 场次的日期和结束时间的组合', async () => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      const sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      const expectedTime = normalizeTimeLabel(featureContext.exhibition.closing_time);
      const expectedBySessionId = new Map(
        sessions.map(session => [
          session.id,
          `${toSessionDateLabel(session.session_date)} ${expectedTime}`,
        ])
      );

      body.shows.forEach(show => {
        expect(show.endTime).toMatch(DATETIME_LABEL_RE);
        expect(show.endTime).toBe(expectedBySessionId.get(show.otShowId));
      });
    });

    And('场次同步消息中每个场次的类型是单场票，值为 {int}', (_ctx, showType: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach(show => {
        expect(show.showType).toBe(showType);
      });
    });

    And('场次同步消息中每个场次的取票方式是电子检票码，值为 {int}', (_ctx, fetchType: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach((show: MopShow) => {
        expect(show.fetchTicketWay).toEqual([fetchType]);
      });
    });

    And('场次同步消息中每个场次的每笔订单最大购买份数是 {int}', (_ctx, limit: number) => {
      const request = getMopRequestArg(featureContext.mopRequestHandler);
      const body = request.body as SyncSessionsToMopRequest;
      body.shows.forEach(show => {
        expect(show.maxBuyLimitPerOrder).toBe(limit);
      });
    });

  });
});
