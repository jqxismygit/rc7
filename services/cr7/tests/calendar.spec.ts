import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, vi } from 'vitest';
import { Exhibition } from '@cr7/types';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import {
  getSessions,
  prepareExhibition,
  prepareTicketCategory,
  updateExhibition,
} from './fixtures/exhibition.js';
import { prepareAdminToken } from './fixtures/user.js';
import { toDateLabel } from './lib/relative-date.js';

const schema = 'test_calendar';
const services = ['api', 'cr7', 'user'];

const feature = await loadFeature('tests/features/calendar.feature');

interface ExhibitionContext {
  ticketByName: Record<string, Exhibition.TicketCategory>;
  exhibition: Exhibition.Exhibition;
  sessions?: Exhibition.Session[];
}

interface FeatureContext extends
  ExhibitionContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
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
  });

  AfterAllScenarios(async () => {
    await featureContext.broker.stop();
  });

  AfterEachScenario(async () => {
    await dropSchema({ schema });
  });

  defineSteps(({ Given }) => {
    Given('展会添加票种 {string}', async (_ctx, ticketName: string) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
        name: ticketName,
      });
      ticketByName[ticketName] = ticket;
      featureContext.ticketByName = ticketByName;
    });
  });

  Background(({ Given, And }) => {
    Given('系统管理员已经创建并登录', async () => {
      await migrate({ schema });
      const { apiServer } = featureContext;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
      expect(featureContext.adminToken).toBeTruthy();
      featureContext.ticketByName = {};
      featureContext.sessions = undefined;
    });

    Given(
      '默认展览活动已创建, 启始时间为 {string}, 结束时间为 {string}',
      async (_ctx, startDate: string, endDate: string) => {
        const { apiServer, adminToken } = featureContext;
        featureContext.exhibition = await prepareExhibition(apiServer, adminToken, {
          start_date: toDateLabel(startDate),
          end_date: toDateLabel(endDate),
        });
      },
    );

    And(
      '默认展会的入场时间为 {string} 到 {string} 最晚入场时间为 {string}',
      async (_ctx, openingTime: string, closingTime: string, lastEntryTime: string) => {
        const { apiServer, adminToken, exhibition } = featureContext;
        featureContext.exhibition = await updateExhibition(
          apiServer,
          adminToken,
          exhibition.id,
          {
            opening_time: openingTime,
            closing_time: closingTime,
            last_entry_time: lastEntryTime,
          },
        );
      },
    );
  });

  Scenario('获取展会的场次信息', (s: StepTest<void>) => {
    const { When, Then } = s;

    When('管理员获取展会场次列表', async () => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.sessions = await getSessions(apiServer, exhibition.id, adminToken, {
        start_session_date: toDateLabel('今天'),
        end_session_date: toDateLabel('1天后'),
      });
    });

    Then('场次列表有 {int} 个场次', (_ctx, expectedCount: number) => {
      const { sessions } = featureContext;
      expect(sessions).toHaveLength(expectedCount);
    });
  });
});
