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
  updateTicketCategory,
  updateExhibitionStatus,
  ExhibitionListResponse,
  DraftExhibition,
  DraftTicketCategory,
  DraftTicketCategoryPatch,
  assertExhibition,
  assertSession,
  assertTicketCategory,
} from './fixtures/exhibition.js';
import { registerUser, prepareAdminToken } from './fixtures/user.js';
import { patchJSON } from './lib/api.js';

const schema = 'test_exhibition';
const services = ['api', 'cr7', 'user'];

const feature = await loadFeature('tests/features/exhibition.feature');

interface FeatureContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
  draftExhibition?: DraftExhibition;
  exhibition?: Exhibition.Exhibition;
  draftTicket?: DraftTicketCategory;
  ticket?: Exhibition.TicketCategory;
  ticketCategories?: Exhibition.TicketCategory[];
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  Background,
  Scenario,
  defineSteps,
  context: featureContext
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

  Background(({ Given }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });

    Given('系统管理员已经创建并登录', async () => {
      const { apiServer } = featureContext;
      const adminToken = await prepareAdminToken(apiServer, schema);
      featureContext.adminToken = adminToken;
      expect(featureContext.adminToken).toBeTruthy();
    });
  });

  defineSteps(({ Given, And, When, Then }) => {
    Given('展览名称为 {string}', (_ctx, name: string) => {
      featureContext.draftExhibition = {
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
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.description = description;
    });

    And('展会开始日期为 {string}', (_ctx, startDate: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.start_date = toDateLabel(startDate);
    });

    And('展会结束日期为 {string}', (_ctx, endDate: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.end_date = toDateLabel(endDate);
    });

    And('展会开放时间为 {string}', (_ctx, openingTime: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.opening_time = openingTime;
    });

    And('展会闭馆时间为 {string}', (_ctx, closingTime: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.closing_time = closingTime;
    });

    And('展会最晚入场时间为 {string}', (_ctx, lastEntryTime: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.last_entry_time = lastEntryTime;
    });

    And('展会城市为 {string}', (_ctx, city: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.city = city;
    });

    And('展会场馆名称为 {string}', (_ctx, venueName: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.venue_name = venueName;
    });

    And('展会地点为 {string}', (_ctx, location: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.location = location;
    });

    And('展会封面图为 {string}', (_ctx, coverUrl: string) => {
      const { draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      draftExhibition!.cover_url = coverUrl;
    });

    When('创建展览', async () => {
      const { apiServer, adminToken, draftExhibition } = featureContext;
      expect(draftExhibition).toBeTruthy();
      const exhibition = await createExhibition(apiServer, adminToken, draftExhibition!);
      featureContext.exhibition = exhibition;
    });

    Given('管理员已创建展览', async () => {
      const { apiServer, adminToken } = featureContext;
      const [exhibition] = await createExhibitions(apiServer, adminToken, 1);
      featureContext.exhibition = exhibition;
    });

    Given('为该展览准备票种草稿 {string}', (_ctx, categoryName: string) => {
      featureContext.draftTicket = { name: categoryName } as DraftTicketCategory;
    });

    And('票种描述为 {string}', (_ctx, description: string) => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.description = description;
    });

    And('票价为 {int}', (_ctx, price: number) => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.price = price;
    });

    And('目录价为 {int}', (_ctx, listPrice: number) => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.list_price = listPrice;
    });

    And('有效期为 {int} 天', (_ctx, days: number) => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.valid_duration_days = days;
    });

    And('退票策略为不可退', () => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.refund_policy = 'NON_REFUNDABLE';
    });

    And('退票策略为场次前 48 小时可退', () => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.refund_policy = 'REFUNDABLE_48H_BEFORE';
    });

    And('准入人数为 {int}', (_ctx, count: number) => {
      const { draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      draftTicket!.admittance = count;
    });

    When('向展览添加票种', async () => {
      const { apiServer, adminToken, exhibition, draftTicket } = featureContext;
      expect(exhibition).toBeTruthy();
      expect(draftTicket).toBeTruthy();

      featureContext.ticket = await addTicketCategory(
        apiServer,
        adminToken,
        exhibition!.id,
        draftTicket!,
      );
    });

    And('已为该展览创建票种 {string}', async (_ctx, ticketName: string) => {
      const { exhibition, apiServer, adminToken } = featureContext;
      featureContext.ticket = await addTicketCategory(
        apiServer,
        adminToken,
        exhibition!.id,
        {
          name: ticketName,
          description: `${ticketName}_description`,
          price: 150,
          list_price: 200,
          valid_duration_days: 10,
          refund_policy: 'REFUNDABLE_48H_BEFORE',
          admittance: 2,
        },
      );
    });

    Then('票种 {string} 添加成功', (_ctx, categoryName: string) => {
      const { ticket, draftTicket } = featureContext;
      expect(draftTicket).toBeTruthy();
      assertTicketCategory(ticket!);
      expect(ticket!.name).toBe(categoryName);
      expect(ticket!.description).toBe(draftTicket!.description);
      expect(ticket!.valid_duration_days).toBe(draftTicket!.valid_duration_days);
      expect(ticket!.refund_policy).toBe(draftTicket!.refund_policy);
      expect(ticket!.admittance).toBe(draftTicket!.admittance);
      expect(ticket!.list_price).toBe(draftTicket!.list_price ?? draftTicket!.price);
    });

    When('管理员查看展会票种列表', async () => {
      const { exhibition, apiServer, adminToken } = featureContext;
      expect(exhibition).toBeTruthy();
      featureContext.ticketCategories = await getTicketCategories(
        apiServer,
        exhibition!.id,
        adminToken,
      );
    });

    Then('展览包含 {number} 个票种', (_ctx, count: number) => {
      expect(featureContext.ticketCategories).toHaveLength(count);
    });

    And('第 {number} 个票种名称为 {string}', (_ctx, index: number, name: string) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.name).toBe(name);
    });

    And('第 {number} 个票种的描述为 {string}', (_ctx, index: number, description: string) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.description).toBe(description);
    });

    And('第 {number} 个票种目录价为 {number}', (_ctx, index: number, listPrice: number) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.list_price).toBe(listPrice);
    });

    And('第 {number} 个票种有效期为 {number} 天', (_ctx, index: number, validDurationDays: number) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.valid_duration_days).toBe(validDurationDays);
    });

    And('第 {number} 个票种退票策略为不可退', (_ctx, index: number) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.refund_policy).toBe('NON_REFUNDABLE');
    });

    And('第 {number} 个票种退票策略为场次前 48 小时可退', (_ctx, index: number) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
    });

    And('第 {number} 个票种准入人数为 {number}', (_ctx, index: number, admittance: number) => {
      const ticket = featureContext.ticketCategories![index - 1];
      expect(ticket).toBeTruthy();
      expect(ticket.admittance).toBe(admittance);
    });
  });

  Scenario(
    'create a new exhibition',
    (s: StepTest<{
      exhibition?: Exhibition.Exhibition;
    }>) => {
      const { Then, And } = s;

      Then('展览创建成功且票种列表为空', async () => {
        const { exhibition } = featureContext;
        expect(exhibition).toBeTruthy();
        assertExhibition(exhibition!);
        expect(exhibition!.name).toBe('cr7_life_museum');

        const { apiServer, adminToken } = featureContext;
        const categories = await getTicketCategories(
          apiServer, exhibition!.id, adminToken
        );
        expect(categories).toEqual([]);
      });

      And('展览状态默认为下线', () => {
        const { exhibition } = featureContext;
        expect(exhibition!.status).toBe('DISABLE');
      });
    }
  );

  Scenario(
    'admin can update exhibition status by dedicated route',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
    }>) => {
      const { When, Then } = s;

      When('管理员将展览状态更新为 {string}', async (_ctx, status: string) => {
        const { apiServer, adminToken, exhibition } = featureContext;
        const { id } = exhibition!;
        await updateExhibitionStatus(
          apiServer,
          adminToken,
          id,
          status as Exhibition.ExhibitionStatus,
        );
        featureContext.exhibition = await getExhibition(apiServer, id, adminToken);
      });

      When('管理员再次将展览状态更新为 {string}', async (_ctx, status: string) => {
        const { apiServer, adminToken, exhibition } = featureContext;
        const { id } = exhibition!;
        await updateExhibitionStatus(
          apiServer,
          adminToken,
          id,
          status as Exhibition.ExhibitionStatus,
        );
        featureContext.exhibition = await getExhibition(apiServer, id, adminToken);
      });

      Then('展览状态更新为 {string}', (_ctx, status: string) => {
        const { exhibition } = featureContext;
        expect(exhibition!.status).toBe(status);
      });

      Then('展览状态再次更新为 {string}', (_ctx, status: string) => {
        const { exhibition } = featureContext;
        expect(exhibition!.status).toBe(status);
      });
    },
  );

  Scenario(
    'add non-refundable ticket category to exhibition',
    () => {}
  );

  Scenario(
    'add a refundable ticket category',
    () => {}
  );

  Scenario(
    'sessions was created when exhibition was created',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      sessions: Exhibition.Session[];
    }>) => {
      const { Then, And, context } = s;

      Then('展览默认按天创建场次', async () => {
        const { exhibition, apiServer, adminToken } = featureContext;
        const sessions = await getSessions(apiServer, exhibition!.id, adminToken);

        expect(sessions.length).toBeGreaterThan(0);
        sessions.forEach(assertSession);
        context.sessions = sessions;
      });

      And('首个场次日期与展览开始日期一致', () => {
        const { exhibition } = featureContext;
        const sessions = context.sessions!;
        expect(isSameDay(sessions[0].session_date, new Date(exhibition!.start_date))).toBe(true);
      });

      And('最后场次日期与展览结束日期一致', () => {
        const { exhibition } = featureContext;
        const sessions = context.sessions!;
        expect(isSameDay(sessions[sessions.length - 1].session_date, new Date(exhibition!.end_date))).toBe(true);
      });

      And('场次数量等于展览持续天数', () => {
        const { exhibition } = featureContext;
        const sessions = context.sessions!;
        const start = new Date(exhibition!.start_date);
        const end = new Date(exhibition!.end_date);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(sessions).toHaveLength(days);
      });
    }
  );

  Scenario(
    'list exhibitions with pagination',
    (s: StepTest<{
      createdExhibitions?: Exhibition.Exhibition[];
      listResult?: ExhibitionListResponse;
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('已为列表创建 {int} 个展览', async (_ctx, count: number) => {
        const { apiServer } = featureContext;
        const createdExhibitions = await createExhibitions(apiServer, featureContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        context.createdExhibitions = createdExhibitions;
      });

      When('按 limit {int} 和 offset {int} 查询管理员展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = featureContext;
        const listResult = await listAdminExhibitions(apiServer, featureContext.adminToken, { limit, offset });
        context.listResult = listResult;
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(context.listResult!.data).toHaveLength(count);
      });

      And('展览按 created_at 倒序排列', () => {
        const listResult = context.listResult!;
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
    (s: StepTest<{
      createdExhibitions?: Exhibition.Exhibition[];
      listResult?: ExhibitionListResponse;
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('已为列表创建 {int} 个展览', async (_ctx, count: number) => {
        const { apiServer } = featureContext;
        const createdExhibitions = await createExhibitions(apiServer, featureContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        context.createdExhibitions = createdExhibitions;
      });

      When('按 limit {int} 和 offset {int} 查询管理员展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = featureContext;
        const listResult = await listAdminExhibitions(apiServer, featureContext.adminToken, { limit, offset });
        context.listResult = listResult;
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(context.listResult!.data).toHaveLength(count);
      });

      And('返回的是第二个创建的展览', () => {
        const { createdExhibitions } = context;
        expect(context.listResult!.data[0].id).toBe(createdExhibitions![1].id);
      });
    }
  );

  Scenario(
    'list exhibitions only returns enabled records',
    (s: StepTest<{
      createdExhibitions: Exhibition.Exhibition[];
      listResult?: ExhibitionListResponse;
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('已为列表创建 {int} 个展览', async (_ctx, count: number) => {
        const { apiServer } = featureContext;
        const createdExhibitions = await createExhibitions(apiServer, featureContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        context.createdExhibitions = createdExhibitions;
      });

      And('管理员将第 {int} 个展览状态更新为 {string}', async (_ctx, index: number, status: string) => {
        const { apiServer } = featureContext;
        const { createdExhibitions } = context;
        const target = createdExhibitions![index - 1];
        await updateExhibitionStatus(
          apiServer,
          featureContext.adminToken,
          target.id,
          status as Exhibition.ExhibitionStatus,
        );
      });

      When('按 limit {int} 和 offset {int} 查询展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = featureContext;
        const listResult = await listExhibitions(apiServer, featureContext.adminToken, { limit, offset });
        context.listResult = listResult;
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(context.listResult!.data).toHaveLength(count);
      });

      And('返回的是第 {int} 个创建的展览', (_ctx, index: number) => {
        const { createdExhibitions } = context;
        expect(context.listResult!.data[0].id).toBe(createdExhibitions![index - 1].id);
      });
    }
  );

  Scenario(
    'list exhibitions empty result',
    (s: StepTest<{
      listResult: ExhibitionListResponse;
    }>) => {
      const { When, Then, context } = s;

      When('按 limit {int} 和 offset {int} 查询管理员展览列表', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = featureContext;
        const listResult = await listAdminExhibitions(apiServer, featureContext.adminToken, { limit, offset });
        context.listResult = listResult;
      });

      Then('返回 {int} 个展览', (_ctx, count: number) => {
        expect(context.listResult!.data).toHaveLength(count);
      });
    }
  );

  Scenario(
    'non-admin user cannot create exhibition',
    (s: StepTest<{
      regularUserToken: string;
      exhibitionCreatePromise: Promise<Exhibition.Exhibition>;
    }>) => {
      const { Given, When, Then, context } = s;

      Given('普通用户已登录', async () => {
        const { apiServer } = featureContext;
        const regularUserToken = await registerUser(apiServer);
        context.regularUserToken = regularUserToken;
      });

      When('普通用户尝试创建展览，名称为 {string}', async (_ctx, name: string) => {
        const { apiServer } = featureContext;
        const { regularUserToken } = context;
        const draftExhibition = {
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

        context.exhibitionCreatePromise = createExhibition(
          apiServer, regularUserToken!, draftExhibition
        );
      });

      Then('返回权限不足错误', async () => {
        await expect(context.exhibitionCreatePromise).rejects.toMatchObject({
          status: 403,
        });
      });
    }
  );

  Scenario(
    'non-admin user cannot add ticket category to exhibition',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      regularUserToken: string;
      ticketCreatePromise: Promise<Exhibition.TicketCategory>;
    }>) => {
      const { Given, When, Then, context } = s;

      Given('普通用户已登录', async () => {
        const { apiServer } = featureContext;
        const regularUserToken = await registerUser(apiServer);
        context.regularUserToken = regularUserToken;
      });

      When('普通用户尝试为展览添加票种', async () => {
        const { apiServer } = featureContext;
        const { exhibition } = featureContext;
        const { regularUserToken } = context;
        const draftTicket: DraftTicketCategory = {
          name: 'unauthorized_ticket',
          description: 'unauthorized ticket description',
          price: 100,
          list_price: 120,
          valid_duration_days: 1,
          refund_policy: 'NON_REFUNDABLE',
          admittance: 1,
        };

        context.ticketCreatePromise = addTicketCategory(
          apiServer,
          regularUserToken!,
          exhibition!.id,
          draftTicket,
        );
      });

      Then('返回权限不足错误', async () => {
        await expect(context.ticketCreatePromise).rejects.toMatchObject({
          status: 403,
        });
      });
    }
  );

  Scenario(
    '可以更新展览的基本信息',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      draftUpdate: Partial<DraftExhibition>;
    }>) => {
      const { Given, When, Then, And, context } = s;

      Then('展览创建成功', () => {
        const { exhibition } = featureContext;
        assertExhibition(exhibition!);
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
        const { apiServer, adminToken, exhibition } = featureContext;
        const updated = await updateExhibition(
          apiServer,
          adminToken,
          exhibition!.id,
          context.draftUpdate!,
        );
        context.exhibition = updated;
        featureContext.exhibition = updated;
      });

      Then('展览描述更新成功', () => {
        const { exhibition } = context;
        assertExhibition(exhibition!);
        expect(exhibition!.description).toBe('updated description');
        expect(exhibition!.cover_url).toBe('https://example.com/updated_cr7_life_museum.jpg');
        expect(exhibition!.opening_time).toBe('09:00:00');
        expect(exhibition!.closing_time).toBe('17:00:00');
        expect(exhibition!.last_entry_time).toBe('16:00:00');
        expect(exhibition!.location).toBe('Beijing');
        expect(exhibition!.city).toBe('北京');
        expect(exhibition!.venue_name).toBe('北京展览中心');
      });
    }
  );

  Scenario(
    '更新展览时必须至少提供一个参数',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      exhibitionUpdatePromise: Promise<Exhibition.Exhibition>;
    }>) => {
      const { When, Then, context } = s;

      When('不提供任何参数更新展览', async () => {
        const { exhibition } = featureContext;
        const { apiServer, adminToken } = featureContext;
        context.exhibitionUpdatePromise = updateExhibition(
          apiServer,
          adminToken,
          exhibition!.id,
          {},
        );
      });

      Then('返回参数不合法错误', async () => {
        await expect(context.exhibitionUpdatePromise).rejects.toMatchObject({
          status: 400,
          method: 'PATCH'
        });
      });
    }
  );

  Scenario(
    '更新展览时不能修改开始和结束日期',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      exhibitionUpdatePromise: Promise<Exhibition.Exhibition>;
    }>) => {
      const { When, Then, context } = s;

      When('尝试更新展览开始和结束日期', async () => {
        const { exhibition } = featureContext;
        const { apiServer, adminToken } = featureContext;

        context.exhibitionUpdatePromise = patchJSON<Exhibition.Exhibition>(
          apiServer,
          `/exhibition/${exhibition!.id}`,
          {
            token: adminToken,
            body: {
              start_date: toDateLabel('5天后'),
              end_date: toDateLabel('66天后'),
            },
          },
        );
      });

      Then('返回参数不合法错误', async () => {
        await expect(context.exhibitionUpdatePromise).rejects.toMatchObject({
          status: 400,
          method: 'PATCH',
        });
      });
    }
  );

  Scenario(
    '可以更新票种信息',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      ticket: Exhibition.TicketCategory;
      ticketPatch: DraftTicketCategoryPatch;
      ticketCategories: Exhibition.TicketCategory[];
    }>) => {
      const { Given, And, When, Then, context } = s;

      Given('准备更新票种名称为 {string}', (_ctx, name: string) => {
        context.ticketPatch ??= {};
        context.ticketPatch!.name = name;
      });

      And('准备更新票种描述为 {string}', (_ctx, description: string) => {
        context.ticketPatch ??= {};
        context.ticketPatch!.description = description;
      });

      And('准备更新票种有效期为 {int} 天', (_ctx, validDurationDays: number) => {
        context.ticketPatch ??= {};
        context.ticketPatch!.valid_duration_days = validDurationDays;
      });

      And('准备更新票种退票策略为不可退', () => {
        context.ticketPatch ??= {};
        context.ticketPatch!.refund_policy = 'NON_REFUNDABLE';
      });

      And('准备更新票种准入人数为 {int}', (_ctx, admittance: number) => {
        context.ticketPatch ??= {};
        context.ticketPatch!.admittance = admittance;
      });

      And('准备更新票种目录价为 {number}', (_ctx, listPrice: number) => {
        context.ticketPatch ??= {};
        context.ticketPatch!.list_price = listPrice;
      });

      When('更新票种信息', async () => {
        const { exhibition } = featureContext;
        const { ticket } = featureContext;
        const { ticketPatch } = context;
        const { apiServer, adminToken } = featureContext;
        context.ticket = await updateTicketCategory(
          apiServer,
          adminToken,
          exhibition!.id,
          ticket!.id,
          ticketPatch!,
        );
      });

      Then('票种信息更新成功', () => {
        const { ticket } = context;
        assertTicketCategory(ticket!);
        expect(ticket!.name).toBe('vip');
        expect(ticket!.description).toBe('贵宾票，尊享服务');
        expect(ticket!.valid_duration_days).toBe(30);
        expect(ticket!.refund_policy).toBe('NON_REFUNDABLE');
        expect(ticket!.admittance).toBe(4);
        expect(ticket!.list_price).toBe(200);
      });
    }
  );

  Scenario(
    '更新票种时必须至少提供一个参数',
    (s: StepTest<{
      exhibition: Exhibition.Exhibition;
      ticket: Exhibition.TicketCategory;
      ticketUpdatePromise: Promise<Exhibition.TicketCategory>;
    }>) => {
      const { When, Then, context } = s;

      When('不提供任何参数更新票种', async () => {
        const { exhibition } = featureContext;
        const { ticket } = featureContext;
        const { apiServer, adminToken } = featureContext;
        context.ticketUpdatePromise = updateTicketCategory(
          apiServer,
          adminToken,
          exhibition!.id,
          ticket!.id,
          {},
        );
      });

      Then('返回参数不合法错误', async () => {
        await expect(context.ticketUpdatePromise).rejects.toMatchObject({
          status: 400,
          method: 'PATCH',
        });
      });
    }
  );
});
