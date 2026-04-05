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
import { Exhibition } from '@cr7/types';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import { prepareExhibition, prepareTicketCategory, updateExhibition } from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { setupMopMockServer, syncExhibitionToMop } from './fixtures/mop.js';
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

  defineSteps(({ And }) => {
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

    Then('猫眼收到请求可以正常解密，签名无误', () => {
      const { mopRequestHandler } = featureContext;
      expect(mopRequestHandler).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.anything(),
        uri: expect.anything()
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
});
