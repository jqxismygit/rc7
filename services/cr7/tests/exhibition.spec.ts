import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, vi } from 'vitest';
import { Exhibition } from '@cr7/types';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import {
  createExhibition,
  addTicketCategory,
  createExhibitions,
  getTicketCategories,
  getSessions,
  listExhibitions,
  ExhibitionListResponse,
  DraftExhibition,
  DraftTicketCategory,
  assertExhibition,
  assertSession,
  assertTicketCategory,
} from './fixtures/exhibition.js';
import { registerUser, prepareAdminToken } from './fixtures/user.js';
import { APIError } from './lib/api.js';

const schema = 'test_exhibition';
const services = ['api', 'cr7', 'user'];

const feature = await loadFeature('tests/features/exhibition.feature');

type ExhibitionType = Exhibition.Exhibition;
type SessionType = Exhibition.Session;
type TicketCategory = Exhibition.TicketCategory;
type DraftTicket = DraftTicketCategory;

type DraftExhibitionContext = {
  draftExhibition?: DraftExhibition;
};

type ExhibitionContext = {
  exhibition?: ExhibitionType;
};

type DraftTicketContext = {
  draftTicket?: DraftTicket;
};

type TicketContext = {
  ticket?: TicketCategory;
};

type SessionsContext = {
  sessions?: SessionType[];
};

type CreatedExhibitionsContext = {
  createdExhibitions?: ExhibitionType[];
};

type ExhibitionListResultContext = {
  listResult?: ExhibitionListResponse;
};

type PermissionErrorContext = {
  lastError?: unknown;
};

type CreateExhibitionScenarioContext = DraftExhibitionContext & ExhibitionContext;
type TicketCategoryScenarioContext = ExhibitionContext & DraftTicketContext & TicketContext;
type SessionsScenarioContext = ExhibitionContext & SessionsContext;
type ExhibitionListScenarioContext = CreatedExhibitionsContext & ExhibitionListResultContext;

type NonAdminCreateScenarioContext = PermissionErrorContext & DraftExhibitionContext & {
  regularUserToken?: string;
};

type NonAdminAddTicketScenarioContext = PermissionErrorContext & ExhibitionContext & DraftTicketContext & {
  regularUserToken?: string;
};

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  adminToken: string;
}

function rememberError(context: PermissionErrorContext, error: unknown) {
  Object.assign(context, { lastError: error });
}

function assertPermissionDenied(error: unknown) {
  expect(error).toBeTruthy();
  expect(error).toBeInstanceOf(APIError);
  expect((error as APIError).status).toBe(403);
}

function requireDraftExhibition(context: DraftExhibitionContext) {
  expect(context.draftExhibition).toBeTruthy();
  return context.draftExhibition!;
}

function requireExhibition(context: ExhibitionContext) {
  expect(context.exhibition).toBeTruthy();
  return context.exhibition!;
}

function requireDraftTicket(context: DraftTicketContext) {
  expect(context.draftTicket).toBeTruthy();
  return context.draftTicket!;
}

function requireTicket(context: TicketContext) {
  expect(context.ticket).toBeTruthy();
  return context.ticket!;
}

function requireSessions(context: SessionsContext) {
  expect(context.sessions).toBeTruthy();
  return context.sessions!;
}

function requireCreatedExhibitions(context: CreatedExhibitionsContext) {
  expect(context.createdExhibitions).toBeTruthy();
  return context.createdExhibitions!;
}

function requireListResult(context: ExhibitionListResultContext) {
  expect(context.listResult).toBeTruthy();
  return context.listResult!;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  Background,
  Scenario,
  context: scenarioContext
}: FeatureDescriibeCallbackParams<ScenarioContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    const fixtures = await useFixtures(
      { ...services_fixtures, schema, services },
      ['apiServer']
    );
    Object.assign(scenarioContext, { fixtures });
  });

  AfterAllScenarios(async () => {
    await scenarioContext.fixtures.close();
  });

  Background(({ Given }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const adminToken = await prepareAdminToken(apiServer, schema);
      Object.assign(scenarioContext, { adminToken });
      expect(scenarioContext.adminToken).toBeTruthy();
    });
  });

  Scenario(
    'create a new exhibition',
    (s: StepTest<CreateExhibitionScenarioContext>) => {
      const { Given, When, Then, And, context } = s;
      Given('展览名称为 {word}', (_ctx, name: string) => {
        Object.assign(context, {
          draftExhibition: {
            name,
            description: null,
            start_date: null,
            end_date: null,
            opening_time: null,
            closing_time: null,
            last_entry_time: null,
            location: null,
          },
        });
      });

      And('描述为 {string}', (_ctx, description: string) => {
        requireDraftExhibition(context).description = description;
      });

      And('开始日期为 {string}', (_ctx, startDate: string) => {
        requireDraftExhibition(context).start_date = startDate;
      });

      And('结束日期为 {string}', (_ctx, endDate: string) => {
        requireDraftExhibition(context).end_date = endDate;
      });

      And('开放时间为 {string}', (_ctx, openingTime: string) => {
        requireDraftExhibition(context).opening_time = openingTime;
      });

      And('闭馆时间为 {string}', (_ctx, closingTime: string) => {
        requireDraftExhibition(context).closing_time = closingTime;
      });

      And('最晚入场时间为 {string}', (_ctx, lastEntryTime: string) => {
        requireDraftExhibition(context).last_entry_time = lastEntryTime;
      });

      And('地点为 {string}', (_ctx, location: string) => {
        requireDraftExhibition(context).location = location;
      });

      When('创建展览', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const exhibition = await createExhibition(
          apiServer,
          scenarioContext.adminToken,
          requireDraftExhibition(context),
        );
        Object.assign(context, { exhibition });
      });

      Then('展览创建成功且票种列表为空', async () => {
        const exhibition = requireExhibition(context);
        expect(exhibition).toBeTruthy();
        assertExhibition(exhibition);
        expect(exhibition.name).toBe('cr7_life_museum');

        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, exhibition.id, scenarioContext.adminToken);
        expect(categories).toEqual([]);
      });
    }
  );

  Scenario(
    'add non-refundable ticket category to exhibition',
    (s: StepTest<TicketCategoryScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已创建展览', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        Object.assign(context, { exhibition });
      });

      Given('为该展览准备票种草稿 {string}', (_ctx, categoryName: string) => {
        Object.assign(context, { draftTicket: { name: categoryName } });
      });

      And('票价为 {int}', (_ctx, price: number) => {
        requireDraftTicket(context).price = price;
      });

      And('有效期为 {int} 天', (_ctx, days: number) => {
        requireDraftTicket(context).valid_duration_days = days;
      });

      And('退票策略为不可退', () => {
        requireDraftTicket(context).refund_policy = 'NON_REFUNDABLE';
      });

      And('准入人数为 {int}', (_ctx, count: number) => {
        requireDraftTicket(context).admittance = count;
      });

      When('向展览添加票种', async () => {
        const exhibition = requireExhibition(context);
        const draftTicket = requireDraftTicket(context);
        expect(exhibition).toBeTruthy();
        expect(draftTicket).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const category = await addTicketCategory(
          apiServer,
          scenarioContext.adminToken,
          exhibition.id,
          draftTicket,
        );

        Object.assign(context, { ticket: category });
      });

      Then('票种 {string} 添加成功', (_ctx, categoryName: string) => {
        const ticket = requireTicket(context);
        assertTicketCategory(ticket);
        expect(ticket.name).toBe(categoryName);
        expect(ticket.price).toBe(100);
        expect(ticket.valid_duration_days).toBe(1);
        expect(ticket.refund_policy).toBe('NON_REFUNDABLE');
        expect(ticket.admittance).toBe(1);
      });

      And('展览包含 {int} 个票种 {string}', async (_ctx, count: number, categoryName: string) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(
          apiServer,
          requireExhibition(context).id,
          scenarioContext.adminToken,
        );
        expect(categories).toHaveLength(count);
        expect(categories.some(item => item.name === categoryName)).toBe(true);
        expect(categories[0]).toMatchObject(requireTicket(context));
      });
    }
  );

  Scenario(
    'add a refundable ticket category',
    (s: StepTest<TicketCategoryScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已创建展览', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        Object.assign(context, { exhibition });
      });

      Given('为该展览准备票种草稿 {string}', (_ctx, categoryName: string) => {
        Object.assign(context, { draftTicket: { name: categoryName } });
      });

      And('票价为 {int}', (_ctx, price: number) => {
        requireDraftTicket(context).price = price;
      });

      And('有效期为 {int} 天', (_ctx, days: number) => {
        requireDraftTicket(context).valid_duration_days = days;
      });

      And('退票策略为场次前 48 小时可退', () => {
        requireDraftTicket(context).refund_policy = 'REFUNDABLE_48H_BEFORE';
      });

      And('准入人数为 {int}', (_ctx, count: number) => {
        requireDraftTicket(context).admittance = count;
      });

      When('向展览添加票种', async () => {
        const exhibition = requireExhibition(context);
        const draftTicket = requireDraftTicket(context);
        expect(exhibition).toBeTruthy();
        expect(draftTicket).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const ticket = await addTicketCategory(
          apiServer,
          scenarioContext.adminToken,
          exhibition.id,
          draftTicket,
        );

        Object.assign(context, { ticket });
      });

      Then('票种 {string} 添加成功', (_ctx, categoryName: string) => {
        const ticket = requireTicket(context);
        assertTicketCategory(ticket);
        expect(ticket.name).toBe(categoryName);
        expect(ticket.price).toBe(150);
        expect(ticket.valid_duration_days).toBe(10);
        expect(ticket.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
        expect(ticket.admittance).toBe(2);
      });

      And(
        '展览包含 {int} 个票种 {string}',
        async (_ctx, count: number, name: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const categories = await getTicketCategories(
            apiServer,
            requireExhibition(context).id,
            scenarioContext.adminToken,
          );
          expect(categories).toHaveLength(count);
          expect(categories.some(item => item.name === name)).toBe(true);
          expect(categories[0]).toMatchObject(requireTicket(context));
        },
      );
    }
  );

  Scenario(
    'sessions was created when exhibition was created',
    (s: StepTest<SessionsScenarioContext>) => {
      const { Given, Then, And, context } = s;

      Given('已创建展览', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        Object.assign(context, { exhibition });
      });

      Then('展览默认按天创建场次', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const sessions = await getSessions(apiServer, requireExhibition(context).id, scenarioContext.adminToken);

        expect(sessions.length).toBeGreaterThan(0);
        sessions.forEach(assertSession);
        Object.assign(context, { sessions });
      });

      And('首个场次日期与展览开始日期一致', () => {
        const exhibition = requireExhibition(context);
        const sessions = requireSessions(context);
        expect(sessions[0].session_date).toBe(exhibition.start_date);
      });

      And('最后场次日期与展览结束日期一致', () => {
        const exhibition = requireExhibition(context);
        const sessions = requireSessions(context);
        expect(sessions[sessions.length - 1].session_date).toBe(exhibition.end_date);
      });

      And('场次数量等于展览持续天数', () => {
        const exhibition = requireExhibition(context);
        const sessions = requireSessions(context);
        const start = new Date(exhibition.start_date);
        const end = new Date(exhibition.end_date);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(sessions).toHaveLength(days);
      });
    }
  );

  Scenario(
    'list exhibitions with pagination',
    (s: StepTest<ExhibitionListScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已为列表创建 {int} 个展览', async (_ctx, count: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        Object.assign(context, { createdExhibitions });
      });

      When('按 limit {int} 和 offset {int} 查询展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(requireListResult(context).data).toHaveLength(count);
      });

      And('展览按 created_at 倒序排列', () => {
        const listResult = requireListResult(context);
        for (let i = 1; i < listResult.data.length; i++) {
          const previous = new Date(listResult.data[i - 1].created_at).getTime();
          const current = new Date(listResult.data[i].created_at).getTime();
          expect(previous).toBeGreaterThanOrEqual(current);
        }
      });
    }
  );

  Scenario(
    'list exhibitions with limit and offset',
    (s: StepTest<ExhibitionListScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已为列表创建 {int} 个展览', async (_ctx, count: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        Object.assign(context, { createdExhibitions });
      });

      When('按 limit {int} 和 offset {int} 查询展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(requireListResult(context).data).toHaveLength(count);
      });

      And('返回的是第二个创建的展览', () => {
        expect(requireListResult(context).data[0].id).toBe(requireCreatedExhibitions(context)[1].id);
      });
    }
  );

  Scenario(
    'list exhibitions empty result',
    (s: StepTest<ExhibitionListResultContext>) => {
      const { When, Then, context } = s;

      When('按 limit {int} 和 offset {int} 查询展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(requireListResult(context).data).toHaveLength(count);
      });
    }
  );

  Scenario(
    'non-admin user cannot create exhibition',
    (s: StepTest<NonAdminCreateScenarioContext>) => {
      const { Given, When, Then, context } = s;

      Given('普通用户已登录', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('普通用户尝试创建展览，名称为 {string}', async (_ctx, name: string) => {
        const { apiServer } = scenarioContext.fixtures.values;
        Object.assign(context, {
          draftExhibition: {
            name,
            description: 'unauthorized exhibition',
            start_date: '2026-01-01',
            end_date: '2026-12-31',
            opening_time: '10:00',
            closing_time: '18:00',
            last_entry_time: '17:00',
            location: 'Test Location',
          },
        });

        try {
          await createExhibition(apiServer, context.regularUserToken, requireDraftExhibition(context));
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('返回权限不足错误', () => {
        assertPermissionDenied(context.lastError);
      });
    }
  );

  Scenario(
    'non-admin user cannot add ticket category to exhibition',
    (s: StepTest<NonAdminAddTicketScenarioContext>) => {
      const { Given, When, Then, context } = s;

      Given('管理员已创建展览', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        Object.assign(context, { exhibition });
      });

      Given('普通用户已登录', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('普通用户尝试为展览添加票种', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        Object.assign(context, {
          draftTicket: {
            name: 'unauthorized_ticket',
            price: 100,
            valid_duration_days: 1,
            refund_policy: 'NON_REFUNDABLE',
            admittance: 1,
          },
        });

        try {
          await addTicketCategory(
            apiServer,
            context.regularUserToken,
            requireExhibition(context).id,
            requireDraftTicket(context),
          );
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('返回权限不足错误', () => {
        assertPermissionDenied(context.lastError);
      });
    }
  );
});
