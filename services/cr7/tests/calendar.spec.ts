import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { format, parse, parseISO } from 'date-fns';
import { expect, vi } from 'vitest';
import { Exhibition, Inventory } from '@cr7/types';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import {
  getTicketCalendarInventory,
  updateTicketCategoryMaxInventory,
  updateTicketCalendarPrice,
} from './fixtures/inventory.js';
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

function parseDatetimeCell(value: string, fieldName: string): string {
  const match = value.match(/^"(.+)"\s+(\d{2}:\d{2}(?::\d{2})?)$/);
  expect(match, `${fieldName} 格式不合法: ${value}`).toBeTruthy();
  const sessionDate = toDateLabel(match![1]);
  const time = normalizeTimeLabel(match![2]);
  return `${sessionDate} ${time}`;
}

function normalizeSessionName(value: string): string {
  if (/^\d+天后$/.test(value) || value === '今天') {
    return toDateLabel(value);
  }

  return value;
}

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_REGEX = new RegExp(`^${UUID_PATTERN}$`, 'i');
const UUID_AM_REGEX = new RegExp(`^${UUID_PATTERN}-AM$`, 'i');
const UUID_PM_REGEX = new RegExp(`^${UUID_PATTERN}-PM$`, 'i');

interface ExhibitionContext {
  ticketByName: Record<string, Exhibition.TicketCategory>;
  exhibition: Exhibition.Exhibition;
  sessions?: Exhibition.Session[];
}

interface TicketCalendarContext {
  ticketCalendar: Array<Inventory.TicketCalendarInventory>;
}

interface FeatureContext extends
  ExhibitionContext,
  Partial<TicketCalendarContext> {
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

  defineSteps(({ Given, When, Then }) => {
    Given('展会添加票种 {string}, 价格为 {int}', async (_ctx, ticketName: string, price: number) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = await prepareTicketCategory(apiServer, adminToken, exhibition.id, {
        name: ticketName,
        price,
      });
      ticketByName[ticketName] = ticket;
      featureContext.ticketByName = ticketByName;
    });

    When(
      '管理员第 {int} 次获取 {string} 场次库存价格列表',
      async (
        _ctx, _idx: number, ticketName: string,
      ) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      featureContext.ticketCalendar = await getTicketCalendarInventory(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        {
          start_session_date: toDateLabel('今天'),
          end_session_date: toDateLabel('1天后'),
        },
      );
    });

    Then('第 {int} 次场次库存价格列表有 {int} 个场次库存价格数据', (
      _ctx,
      _fetchIndex: number,
      expectedCount: number,
      dataTable: Array<Record<string, string>>,
    ) => {
      const { ticketCalendar } = featureContext;
      expect(ticketCalendar).toHaveLength(expectedCount);
      expect(dataTable).toHaveLength(expectedCount);

      const expectedRows = dataTable.map((row) => {
        const obj: Record<string, unknown> = {
          session_id: expect.stringMatching(UUID_REGEX),
          session_date: toDateLabel(row['场次日期']),
        };
        if ('价格' in row) {
          obj.price = Number(row['价格'])
        } else if ('库存' in row) {
          obj.quantity = Number(row['库存']);
        } else {
          throw new Error('数据表必须包含 "价格" 或 "库存" 列');
        }
        return obj;
      });

      expect(ticketCalendar).toEqual(
        expectedRows.map((expectedRow) => expect.objectContaining(expectedRow))
      );
    });
  });

  Background(({ Given, And }) => {
    Given('系统管理员已经创建并登录', async () => {
      await migrate({ schema });
      const { apiServer } = featureContext;
      featureContext.adminToken = await prepareAdminToken(apiServer, schema);
      expect(featureContext.adminToken).toBeTruthy();
      featureContext.ticketByName = {};
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

    When('管理员获取展会场次列表, 日场次模式', async () => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.sessions = await getSessions(apiServer, exhibition.id, adminToken, {
        session_mode: 'DAY',
        start_session_date: toDateLabel('今天'),
        end_session_date: toDateLabel('1天后'),
      });
    });

    When('管理员获取展会场次列表, 默认模式，单日分上下午场次', async () => {
      const { apiServer, adminToken, exhibition } = featureContext;
      featureContext.sessions = await getSessions(apiServer, exhibition.id, adminToken, {
        session_mode: 'HALF_DAY',
        start_session_date: toDateLabel('今天'),
        end_session_date: toDateLabel('1天后'),
      });
    });

    Then('每日单场次列表有 {int} 个场次', (
      _ctx: unknown,
      expectedCount: number,
      dataTable: Array<Record<string, string>>,
    ) => {
      const { sessions } = featureContext;
      expect(sessions).toHaveLength(expectedCount);
      expect(dataTable).toHaveLength(expectedCount);

      const expectedRows = dataTable.map((row) => ({
        id: expect.stringMatching(UUID_REGEX),
        session_date: parseISO(toDateLabel(row['场次日期'])),
        name: normalizeSessionName(row['场次名称']),
        opening_time: parseDatetimeCell(row['场次开始时间'], '场次开始时间'),
        closing_time: parseDatetimeCell(row['场次结束时间'], '场次结束时间'),
        last_entry_time: parseDatetimeCell(row['场次最晚入场时间'], '场次最晚入场时间'),
      }));
      expect(sessions).toEqual(
        expectedRows.map((expectedSession) => expect.objectContaining(expectedSession))
      );
    });

    Then('每日两场次列表有 {int} 个场次', (
      _ctx: unknown,
      expectedCount: number,
      dataTable: Array<Record<string, string>>,
    ) => {
      const { sessions } = featureContext;

      expect(sessions).toHaveLength(expectedCount);
      expect(dataTable).toHaveLength(expectedCount);

      const expectedRows = dataTable.map((row) => ({
        id: row['场次 ID'] === 'uuid-AM'
            ? expect.stringMatching(UUID_AM_REGEX)
            : expect.stringMatching(UUID_PM_REGEX),
        session_date: parseISO(toDateLabel(row['场次日期'])),
        name: normalizeSessionName(row['场次名称']),
        opening_time: parseDatetimeCell(row['场次开始时间'], '场次开始时间'),
        closing_time: parseDatetimeCell(row['场次结束时间'], '场次结束时间'),
        last_entry_time: parseDatetimeCell(row['场次最晚入场时间'], '场次最晚入场时间'),
      }));

      expect(sessions).toEqual(
        expectedRows.map((expectedSession) => expect.objectContaining(expectedSession))
      );
    });
  });

  Scenario('设置票种的日历库存', (s: StepTest<void>) => {
    const { Given } = s;

    Given('设置 {string} 场次库存为 {int}', async (_ctx, ticketName: string, quantity: number) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
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

    Given('管理员设置 {string} 的 {string} 到 {string} 的场次库存为 {int}', async (
      _ctx,
      ticketName: string,
      startDateLabel: string,
      endDateLabel: string,
      quantity: number,
    ) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      await updateTicketCategoryMaxInventory(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        quantity,
        {
          start_session_date: toDateLabel(startDateLabel),
          end_session_date: toDateLabel(endDateLabel),
        }
      );
    });
  });

  Scenario('设置票种的日历价格', (s: StepTest<void>) => {
    const { Given } = s;

    Given('管理员设置 {string} 的 {string} 到 {string} 的场次价格为 {int}', async (
      _ctx,
      ticketName: string,
      startDateLabel: string,
      endDateLabel: string,
      price: number,
    ) => {
      const { apiServer, adminToken, exhibition, ticketByName } = featureContext;
      const ticket = ticketByName[ticketName];
      expect(ticket).toBeTruthy();

      await updateTicketCalendarPrice(
        apiServer,
        adminToken,
        exhibition.id,
        ticket.id,
        price,
        {
          start_session_date: toDateLabel(startDateLabel),
          end_session_date: toDateLabel(endDateLabel),
        }
      );
    });
  });

});
