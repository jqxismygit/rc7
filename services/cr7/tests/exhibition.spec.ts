import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { isSameDay } from 'date-fns';
import { expect, vi } from 'vitest';
import { Exhibition } from '@cr7/types';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { toDateLabel } from './lib/relative-date.js';
import {
  createExhibition,
  addTicketCategory,
  createExhibitions,
  getExhibition,
  getTicketCategories,
  getSessions,
  listAdminExhibitions,
  listExhibitions,
  updateExhibition,
  updateExhibitionStatus,
  ExhibitionListResponse,
  DraftExhibition,
  DraftTicketCategory,
  assertExhibition,
  assertSession,
  assertTicketCategory,
} from './fixtures/exhibition.js';
import { registerUser, prepareAdminToken } from './fixtures/user.js';
import { APIError, assertAPIError, patchJSON } from './lib/api.js';

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

type UpdateExhibitionValidationScenarioContext = ExhibitionContext & PermissionErrorContext;

interface ScenarioContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
}

function rememberError(context: PermissionErrorContext, error: unknown) {
  context.lastError = error;
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
    await bootstrap();
    const broker = await prepareServices(services);
    await migrate({ schema });
    await broker.start();
    scenarioContext.broker = broker;
    scenarioContext.apiServer = await prepareAPIServer(broker);
  });

  AfterAllScenarios(async () => {
    await scenarioContext.broker.stop();
    await dropSchema({ schema });
  });

  Background(({ Given }) => {
    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = scenarioContext;
      const adminToken = await prepareAdminToken(apiServer, schema);
      scenarioContext.adminToken = adminToken;
      expect(scenarioContext.adminToken).toBeTruthy();
    });
  });

  Scenario(
    'create a new exhibition',
    (s: StepTest<CreateExhibitionScenarioContext>) => {
      const { Given, When, Then, And, context } = s;
      Given('展览名称为 {word}', (_ctx, name: string) => {
        context.draftExhibition = {
          name,
          description: null,
          start_date: null,
          end_date: null,
          opening_time: null,
          closing_time: null,
          last_entry_time: null,
          city: null,
          venue_name: null,
          location: null,
          cover_url: null,
        } as unknown as DraftExhibition;
      });

      And('展会描述为 {string}', (_ctx, description: string) => {
        requireDraftExhibition(context).description = description;
      });

      And('展会开始日期为 {string}', (_ctx, startDate: string) => {
        requireDraftExhibition(context).start_date = toDateLabel(startDate);
      });

      And('展会结束日期为 {string}', (_ctx, endDate: string) => {
        requireDraftExhibition(context).end_date = toDateLabel(endDate);
      });

      And('展会开放时间为 {string}', (_ctx, openingTime: string) => {
        requireDraftExhibition(context).opening_time = openingTime;
      });

      And('展会闭馆时间为 {string}', (_ctx, closingTime: string) => {
        requireDraftExhibition(context).closing_time = closingTime;
      });

      And('展会最晚入场时间为 {string}', (_ctx, lastEntryTime: string) => {
        requireDraftExhibition(context).last_entry_time = lastEntryTime;
      });

      And('展会城市为 {string}', (_ctx, city: string) => {
        requireDraftExhibition(context).city = city;
      });

      And('展会场馆名称为 {string}', (_ctx, venueName: string) => {
        requireDraftExhibition(context).venue_name = venueName;
      });

      And('展会地点为 {string}', (_ctx, location: string) => {
        requireDraftExhibition(context).location = location;
      });

      And('展会封面图为 {string}', (_ctx, coverUrl: string) => {
        requireDraftExhibition(context).cover_url = coverUrl;
      });

      When('创建展览', async () => {
        const { apiServer } = scenarioContext;
        const exhibition = await createExhibition(
          apiServer,
          scenarioContext.adminToken,
          requireDraftExhibition(context),
        );
        context.exhibition = exhibition;
      });

      Then('展览创建成功且票种列表为空', async () => {
        const exhibition = requireExhibition(context);
        expect(exhibition).toBeTruthy();
        assertExhibition(exhibition);
        expect(exhibition.name).toBe('cr7_life_museum');

        const { apiServer } = scenarioContext;
        const categories = await getTicketCategories(apiServer, exhibition.id, scenarioContext.adminToken);
        expect(categories).toEqual([]);
      });

      And('展览状态默认为下线', () => {
        expect(requireExhibition(context).status).toBe('DISABLE');
      });
    }
  );

  Scenario(
    'admin can update exhibition status by dedicated route',
    (s: StepTest<ExhibitionContext>) => {
      const { Given, When, Then, context } = s;

      Given('已创建展览', async () => {
        const { apiServer } = scenarioContext;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        context.exhibition = exhibition;
      });

      When('管理员将展览状态更新为 {string}', async (_ctx, status: string) => {
        const { apiServer } = scenarioContext;
        const eid = requireExhibition(context).id;
        await updateExhibitionStatus(
          apiServer,
          scenarioContext.adminToken,
          eid,
          status as Exhibition.ExhibitionStatus,
        );
        const exhibition = await getExhibition(apiServer, eid, scenarioContext.adminToken);
        context.exhibition = exhibition;
      });

      When('管理员再次将展览状态更新为 {string}', async (_ctx, status: string) => {
        const { apiServer } = scenarioContext;
        const eid = requireExhibition(context).id;
        await updateExhibitionStatus(
          apiServer,
          scenarioContext.adminToken,
          eid,
          status as Exhibition.ExhibitionStatus,
        );
        const exhibition = await getExhibition(apiServer, eid, scenarioContext.adminToken);
        context.exhibition = exhibition;
      });

      Then('展览状态更新为 {string}', (_ctx, status: string) => {
        expect(requireExhibition(context).status).toBe(status);
      });

      Then('展览状态再次更新为 {string}', (_ctx, status: string) => {
        expect(requireExhibition(context).status).toBe(status);
      });
    },
  );

  Scenario(
    'add non-refundable ticket category to exhibition',
    (s: StepTest<TicketCategoryScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已创建展览', async () => {
        const { apiServer } = scenarioContext;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        context.exhibition = exhibition;
      });

      Given('为该展览准备票种草稿 {string}', (_ctx, categoryName: string) => {
        context.draftTicket = { name: categoryName } as DraftTicket;
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

        const { apiServer } = scenarioContext;
        const category = await addTicketCategory(
          apiServer,
          scenarioContext.adminToken,
          exhibition.id,
          draftTicket,
        );

        context.ticket = category;
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
        const { apiServer } = scenarioContext;
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
        const { apiServer } = scenarioContext;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        context.exhibition = exhibition;
      });

      Given('为该展览准备票种草稿 {string}', (_ctx, categoryName: string) => {
        context.draftTicket = { name: categoryName } as DraftTicket;
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

        const { apiServer } = scenarioContext;
        const ticket = await addTicketCategory(
          apiServer,
          scenarioContext.adminToken,
          exhibition.id,
          draftTicket,
        );

        context.ticket = ticket;
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
          const { apiServer } = scenarioContext;
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
        const { apiServer } = scenarioContext;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        context.exhibition = exhibition;
      });

      Then('展览默认按天创建场次', async () => {
        const { apiServer } = scenarioContext;
        const sessions = await getSessions(apiServer, requireExhibition(context).id, scenarioContext.adminToken);

        expect(sessions.length).toBeGreaterThan(0);
        sessions.forEach(assertSession);
        context.sessions = sessions;
      });

      And('首个场次日期与展览开始日期一致', () => {
        const exhibition = requireExhibition(context);
        const sessions = requireSessions(context);
        expect(isSameDay(sessions[0].session_date, new Date(exhibition.start_date))).toBe(true);
      });

      And('最后场次日期与展览结束日期一致', () => {
        const exhibition = requireExhibition(context);
        const sessions = requireSessions(context);
        expect(isSameDay(sessions[sessions.length - 1].session_date, new Date(exhibition.end_date))).toBe(true);
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
        const { apiServer } = scenarioContext;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        context.createdExhibitions = createdExhibitions;
      });

      When('按 limit {int} 和 offset {int} 查询管理员展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext;
        const listResult = await listAdminExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        context.listResult = listResult;
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
        const { apiServer } = scenarioContext;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        context.createdExhibitions = createdExhibitions;
      });

      When('按 limit {int} 和 offset {int} 查询管理员展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext;
        const listResult = await listAdminExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        context.listResult = listResult;
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
    'list exhibitions only returns enabled records',
    (s: StepTest<ExhibitionListScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已为列表创建 {int} 个展览', async (_ctx, count: number) => {
        const { apiServer } = scenarioContext;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        context.createdExhibitions = createdExhibitions;
      });

      And('管理员将第 {int} 个展览状态更新为 {string}', async (_ctx, index: number, status: string) => {
        const { apiServer } = scenarioContext;
        const target = requireCreatedExhibitions(context)[index - 1];
        await updateExhibitionStatus(
          apiServer,
          scenarioContext.adminToken,
          target.id,
          status as Exhibition.ExhibitionStatus,
        );
      });

      When('按 limit {int} 和 offset {int} 查询展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        context.listResult = listResult;
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(requireListResult(context).data).toHaveLength(count);
      });

      And('返回的是第 {int} 个创建的展览', (_ctx, index: number) => {
        expect(requireListResult(context).data[0].id).toBe(requireCreatedExhibitions(context)[index - 1].id);
      });
    }
  );

  Scenario(
    'list exhibitions empty result',
    (s: StepTest<ExhibitionListResultContext>) => {
      const { When, Then, context } = s;

      When('按 limit {int} 和 offset {int} 查询管理员展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext;
        const listResult = await listAdminExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        context.listResult = listResult;
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
        const { apiServer } = scenarioContext;
        const regularUserToken = await registerUser(apiServer);
        context.regularUserToken = regularUserToken;
      });

      When('普通用户尝试创建展览，名称为 {string}', async (_ctx, name: string) => {
        const { apiServer } = scenarioContext;
        context.draftExhibition = {
          name,
          description: 'unauthorized exhibition',
          start_date: toDateLabel('1天后'),
          end_date: toDateLabel('365天后'),
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          city: '上海',
          venue_name: '上海展览中心',
          location: 'Test Location',
        };

        try {
          await createExhibition(apiServer, context.regularUserToken!, requireDraftExhibition(context));
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
        const { apiServer } = scenarioContext;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        context.exhibition = exhibition;
      });

      Given('普通用户已登录', async () => {
        const { apiServer } = scenarioContext;
        const regularUserToken = await registerUser(apiServer);
        context.regularUserToken = regularUserToken;
      });

      When('普通用户尝试为展览添加票种', async () => {
        const { apiServer } = scenarioContext;
        context.draftTicket = {
          name: 'unauthorized_ticket',
          price: 100,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
          admittance: 1,
        };

        try {
          await addTicketCategory(
            apiServer,
            context.regularUserToken!,
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

    type UpdateExhibitionScenarioContext = DraftExhibitionContext & ExhibitionContext & {
      draftUpdate?: Exhibition.ExhibitionPatch;
    };

    Scenario(
      '可以更新展览的基本信息',
      (s: StepTest<UpdateExhibitionScenarioContext>) => {
          const { Given, When, Then, And, context } = s;

          Given('展览名称为 {string}', (_ctx, name: string) => {
            context.draftExhibition = {
              name,
              description: null,
              start_date: null,
              end_date: null,
              opening_time: null,
              closing_time: null,
              last_entry_time: null,
              city: null,
              venue_name: null,
              location: null,
              cover_url: null,
            } as unknown as DraftExhibition;
          });

          And('展会描述为 {string}', (_ctx, description: string) => {
            requireDraftExhibition(context).description = description;
          });

          And('展会开始日期为 {string}', (_ctx, startDate: string) => {
            requireDraftExhibition(context).start_date = toDateLabel(startDate);
          });

          And('展会结束日期为 {string}', (_ctx, endDate: string) => {
            requireDraftExhibition(context).end_date = toDateLabel(endDate);
          });

          And('展会开放时间为 {string}', (_ctx, openingTime: string) => {
            requireDraftExhibition(context).opening_time = openingTime;
          });

          And('展会闭馆时间为 {string}', (_ctx, closingTime: string) => {
            requireDraftExhibition(context).closing_time = closingTime;
          });

          And('展会最晚入场时间为 {string}', (_ctx, lastEntryTime: string) => {
            requireDraftExhibition(context).last_entry_time = lastEntryTime;
          });

          And('展会城市为 {string}', (_ctx, city: string) => {
            requireDraftExhibition(context).city = city;
          });

          And('展会场馆名称为 {string}', (_ctx, venueName: string) => {
            requireDraftExhibition(context).venue_name = venueName;
          });

          And('展会地点为 {string}', (_ctx, location: string) => {
            requireDraftExhibition(context).location = location;
          });

          And('展会封面图为 {string}', (_ctx, coverUrl: string) => {
            requireDraftExhibition(context).cover_url = coverUrl;
          });

          When('创建展览', async () => {
            const { apiServer } = scenarioContext;
            const exhibition = await createExhibition(
              apiServer,
              scenarioContext.adminToken,
              requireDraftExhibition(context) as Required<DraftExhibition>,
            );
            context.exhibition = exhibition;
          });

          Then('展览创建成功', () => {
            assertExhibition(requireExhibition(context));
          });

          Given('准备更新展览名称为 {string}', (_ctx, name: string) => {
            context.draftUpdate = { name };
          });

          And('准备更新展会描述为 {string}', (_ctx, description: string) => {
            context.draftUpdate!.description = description;
          });

          And('准备更新展会开放时间为 {string}', (_ctx, openingTime: string) => {
            context.draftUpdate!.opening_time = openingTime;
          });

          And('准备更新展会闭馆时间为 {string}', (_ctx, closingTime: string) => {
            context.draftUpdate!.closing_time = closingTime;
          });

          And('准备更新展会最晚入场时间为 {string}', (_ctx, lastEntryTime: string) => {
            context.draftUpdate!.last_entry_time = lastEntryTime;
          });

          And('准备更新展会地点为 {string}', (_ctx, location: string) => {
            context.draftUpdate!.location = location;
          });

          And('准备更新展会城市为 {string}', (_ctx, city: string) => {
            context.draftUpdate!.city = city;
          });

          And('准备更新展会场馆名称为 {string}', (_ctx, venueName: string) => {
            context.draftUpdate!.venue_name = venueName;
          });

          And('准备更新展会封面图为 {string}', (_ctx, coverUrl: string) => {
            context.draftUpdate!.cover_url = coverUrl;
          });

          When('更新展览信息', async () => {
            const { apiServer } = scenarioContext;
            const updated = await updateExhibition(
              apiServer,
              scenarioContext.adminToken,
              requireExhibition(context).id,
              context.draftUpdate!,
            );
            context.exhibition = updated;
          });

          Then('展览描述更新成功', () => {
            const exhibition = requireExhibition(context);
            assertExhibition(exhibition);
            expect(exhibition.description).toBe('updated description');
            expect(exhibition.cover_url).toBe('https://example.com/updated_cr7_life_museum.jpg');
            expect(exhibition.opening_time).toBe('09:00:00');
            expect(exhibition.closing_time).toBe('17:00:00');
            expect(exhibition.last_entry_time).toBe('16:00:00');
            expect(exhibition.location).toBe('Beijing');
            expect(exhibition.city).toBe('北京');
            expect(exhibition.venue_name).toBe('北京展览中心');
          });
        }
      );

    Scenario(
      '更新展览时必须至少提供一个参数',
      (s: StepTest<UpdateExhibitionValidationScenarioContext>) => {
        const { Given, When, Then, context } = s;

        Given('已创建展览', async () => {
          const { apiServer } = scenarioContext;
          const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
          context.exhibition = exhibition;
        });

        When('不提供任何参数更新展览', async () => {
          const { apiServer } = scenarioContext;

          try {
            await updateExhibition(
              apiServer,
              scenarioContext.adminToken,
              requireExhibition(context).id,
              {},
            );
          } catch (error) {
            rememberError(context, error);
          }
        });

        Then('返回参数不合法错误', () => {
          assertAPIError(context.lastError, {
            status: 400,
            method: 'PATCH',
            messageIncludes: '参数不合法',
          });
        });
      }
    );

    Scenario(
      '更新展览时不能修改开始和结束日期',
      (s: StepTest<UpdateExhibitionValidationScenarioContext>) => {
        const { Given, When, Then, context } = s;

        Given('已创建展览', async () => {
          const { apiServer } = scenarioContext;
          const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
          context.exhibition = exhibition;
        });

        When('尝试更新展览开始和结束日期', async () => {
          const { apiServer } = scenarioContext;

          try {
            await patchJSON<Exhibition.Exhibition>(
              apiServer,
              `/exhibition/${requireExhibition(context).id}`,
              {
                token: scenarioContext.adminToken,
                body: {
                  start_date: toDateLabel('5天后'),
                  end_date: toDateLabel('66天后'),
                },
              },
            );
          } catch (error) {
            rememberError(context, error);
          }
        });

        Then('返回参数不合法错误', () => {
          assertAPIError(context.lastError, {
            status: 400,
            method: 'PATCH',
            messageIncludes: '参数不合法',
          });
        });
      }
    );
  });
