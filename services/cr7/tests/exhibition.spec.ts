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
  getTicketCategories,
  getSessions,
  listExhibitions,
  ExhibitionListResponse,
  assertExhibition,
  assertSession,
  assertTicketCategory
} from './fixtures/exhibition.js';
import { random_text } from './lib/random.js';
import { registerUser, prepareAdminToken } from './fixtures/user.js';
import { APIError } from './lib/api.js';

const schema = 'test_exhibition';
const services = ['api', 'cr7', 'user'];

const feature = await loadFeature('tests/features/exhibition.feature');

type ExhibitionType = Exhibition.Exhibition;
type SessionType = Exhibition.Session;
type TicketCategory = Exhibition.TicketCategory;
type DraftExhibition = Omit<ExhibitionType, 'id' | 'created_at' | 'updated_at'>;
type DraftTicket = Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>;

async function createExhibitionsForTest(
  apiServer,
  token: string,
  count: number,
  namePrefix: string = 'test_exhibition'
): Promise<ExhibitionType[]> {
  const exhibitions: ExhibitionType[] = [];

  for (let i = 0; i < count; i++) {
    const exhibition = await createExhibition(apiServer, token, {
      name: `${namePrefix}_${i + 1}_${random_text(5)}`,
      description: `Test exhibition ${i + 1}`,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Test Location'
    });
    exhibitions.push(exhibition);
  }

  return exhibitions;
}

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  adminToken?: string;
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
    Given('a user with role admin is logged in', async () => {
      const { apiServer } = scenarioContext.fixtures.values;
      const adminToken = await prepareAdminToken(apiServer, schema);
      Object.assign(scenarioContext, { adminToken });
      expect(scenarioContext.adminToken).toBeTruthy();
    });
  });

  Scenario(
    'create a new exhibition',
    (s: StepTest<{ draftExhibition: DraftExhibition, exhibition: ExhibitionType }>) => {
      const { Given, When, Then, And, context } = s;
      Given('exhibition name {word}', (ctx, name: string) => {
        Object.assign(context, {
          draftExhibition: {
            name,
            description: null,
            start_date: null,
            end_date: null,
            opening_time: null,
            closing_time: null,
            last_entry_time: null,
            location: null
          }
        });
      });

      And('description {string}', (ctx, description: string) => {
        context.draftExhibition.description = description;
      });

      And('start date {string}', (ctx, startDate: string) => {
        context.draftExhibition.start_date = startDate;
      });

      And('end date {string}', (ctx, endDate: string) => {
        context.draftExhibition.end_date = endDate;
      });
      And('opening time {string}', (ctx, openingTime: string) => {
        context.draftExhibition.opening_time = openingTime;
      });

      And('closing time {string}', (ctx, closingTime: string) => {
        context.draftExhibition.closing_time = closingTime;
      });

      And('last entry time {string}', (ctx, lastEntryTime: string) => {
        context.draftExhibition.last_entry_time = lastEntryTime;
      });
      And('location {string}', (ctx, location: string) => {
        context.draftExhibition.location = location;
      });

      When('create exhibition', async () => {
        const { draftExhibition } = context;
        const { apiServer } = scenarioContext.fixtures.values;
        const exhibition = await createExhibition(apiServer, scenarioContext.adminToken, draftExhibition);
        Object.assign(context, { exhibition });
      });

      Then('exhibition created successfully with empty ticket categories', async () => {
        const { exhibition } = context;
        expect(exhibition).toBeTruthy();
        assertExhibition(exhibition);
        expect(exhibition.name).toBe('cr7_life_museum');

        // Verify ticket categories are empty by querying separately
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, exhibition.id, scenarioContext.adminToken);
        expect(categories).toEqual([]);
      });
    }
  );

  Scenario(
    'add non-refundable ticket category to exhibition',
    (s: StepTest<{
      exhibition: ExhibitionType,
      draftTicket: DraftTicket,
      ticket: TicketCategory
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitionsForTest(apiServer, scenarioContext.adminToken, 1, 'test_exhibition');
        Object.assign(context, { exhibition });
      });

      Given('draft ticket category {string} to exhibition', (ctx, categoryName: string) => {
        Object.assign(context, { draftTicket: { name: categoryName } });
      });

      And('price {int}', (ctx, price: number) => {
        context.draftTicket.price = price;
      });
      And('valid duration {int} day', (ctx, days: number) => {
        context.draftTicket.valid_duration_days = days;
      });
      And('refund policy non refundable', () => {
        context.draftTicket.refund_policy = 'NON_REFUNDABLE';
      });
      And('admittance {int} person', (ctx, count: number) => {
        context.draftTicket.admittance = count;
      });

      When('add ticket category to exhibition', async () => {
        const { exhibition, draftTicket } = context;
        expect(exhibition).toBeTruthy();
        expect(draftTicket).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const category = await addTicketCategory(
          apiServer,
          scenarioContext.adminToken,
          exhibition!.id,
          draftTicket,
        );

        Object.assign(context, { addedCategory: category });
      });

      Then('ticket {string} added successfully', (ctx, categoryName: string) => {
        const { addedCategory } = context as typeof context & { addedCategory: TicketCategory };
        assertTicketCategory(addedCategory);
        expect(addedCategory.name).toBe(categoryName);
        expect(addedCategory.price).toBe(100);
        expect(addedCategory.valid_duration_days).toBe(1);
        expect(addedCategory.refund_policy).toBe('NON_REFUNDABLE');
        expect(addedCategory.admittance).toBe(1);
        Object.assign(context, { ticket: addedCategory });
      });

      And('exhibition has {int} ticket categories {string}', async (ctx, count: number, categoryName: string) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, context.exhibition.id, scenarioContext.adminToken);
        expect(categories).toHaveLength(count);
        expect(categories.some(item => item.name === categoryName)).toBe(true);
        expect(categories[0]).toMatchObject(context.ticket);
      });
    }
  );

  Scenario(
    'add a refundable ticket category',
    (s: StepTest<{
      exhibition: ExhibitionType;
      draftTicket: DraftTicket,
      ticket: TicketCategory
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitionsForTest(apiServer, scenarioContext.adminToken, 1, 'test_exhibition');
        Object.assign(context, { exhibition });
      });

      Given('draft ticket category {string} to exhibition', (ctx, categoryName: string) => {
        Object.assign(context, { draftTicket: { name: categoryName } });
      });

      And('price {int}', (ctx, price: number) => {
        context.draftTicket.price = price;
      });
      And('valid duration {int} day', (ctx, days: number) => {
        context.draftTicket.valid_duration_days = days;
      });
      And('refund policy refundable until 48 hours before the event', () => {
        context.draftTicket.refund_policy = 'REFUNDABLE_48H_BEFORE';
      });
      And('admittance {int} person', (ctx, count: number) => {
        context.draftTicket.admittance = count;
      });

      When('add ticket category to exhibition', async () => {
        const { exhibition, draftTicket } = context;
        expect(exhibition).toBeTruthy();
        expect(draftTicket).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const ticket = await addTicketCategory(
          apiServer,
          scenarioContext.adminToken,
          exhibition!.id,
          draftTicket as Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>,
        );

        Object.assign(context, { addedCategory: ticket });
      });

      Then('ticket {string} added successfully', (ctx, categoryName: string) => {
        const { addedCategory } = context as typeof context & { addedCategory: TicketCategory };
        assertTicketCategory(addedCategory);
        expect(addedCategory.name).toBe(categoryName);
        expect(addedCategory.price).toBe(150);
        expect(addedCategory.valid_duration_days).toBe(10);
        expect(addedCategory.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
        expect(addedCategory.admittance).toBe(2);
        Object.assign(context, { ticket: addedCategory });
      });

      And(
        'exhibition has {int} ticket categories {string}',
        async (ctx, count: number, name: string) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, context.exhibition.id, scenarioContext.adminToken);
        expect(categories).toHaveLength(count);
        expect(categories.some(item => item.name === name)).toBe(true);
        expect(categories[0]).toMatchObject(context.ticket);
      });
    }
  );

  Scenario(
    'sessions was created when exhibition was created',
    (s: StepTest<{
      exhibition: ExhibitionType;
      sessions: SessionType[];
    }>) => {
      const { Given, Then, And, context } = s;

      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitionsForTest(apiServer, scenarioContext.adminToken, 1, 'test_exhibition');
        Object.assign(context, { exhibition });
      });

      Then('exhibition has daily sessions by default', async () => {
        const { exhibition } = context;
        const { apiServer } = scenarioContext.fixtures.values;
        const sessions = await getSessions(apiServer, exhibition.id, scenarioContext.adminToken);

        expect(sessions.length).toBeGreaterThan(0);
        sessions.forEach(assertSession);
        Object.assign(context, { sessions });
      });

      And('the session date of the first session is the same as the start date of the exhibition', () => {
        const { exhibition, sessions } = context;
        expect(sessions[0].session_date).toBe(exhibition.start_date);
      });

      And('the session date of the last session is the same as the end date of the exhibition', () => {
        const { exhibition, sessions } = context;
        expect(sessions[sessions.length - 1].session_date).toBe(exhibition.end_date);
      });

      And('the total number of sessions is exhibition duration in days', () => {
        const { exhibition, sessions } = context;
        const start = new Date(exhibition.start_date);
        const end = new Date(exhibition.end_date);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        expect(sessions).toHaveLength(days);
      });
    }
  );

  Scenario(
    'list exhibitions with pagination',
    (s: StepTest<{
      createdExhibitions: Exhibition.Exhibition[]
      listResult: ExhibitionListResponse
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('created {int} exhibitions for listing', async (ctx, count: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const createdExhibitions = await createExhibitionsForTest(apiServer, scenarioContext.adminToken, count, 'list_exhibition');
        Object.assign(context, { createdExhibitions });
      });

      When('list exhibitions with limit {int} and offset {int}', async (ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('return {int} exhibitions', (ctx, count: number) => {
        expect(context.listResult.data).toHaveLength(count);
      });

      And('exhibitions are ordered by created_at descending', () => {
        for (let i = 1; i < context.listResult.data.length; i++) {
          const previous = new Date(context.listResult.data[i - 1].created_at).getTime();
          const current = new Date(context.listResult.data[i].created_at).getTime();
          expect(previous).toBeGreaterThanOrEqual(current);
        }
      });
    }
  );

  Scenario(
    'list exhibitions with limit and offset',
    (s: StepTest<{
      createdExhibitions: Exhibition.Exhibition[]
      listResult: ExhibitionListResponse
    }>) => {
      const { Given, When, Then, And, context } = s;

      Given('created {int} exhibitions for listing', async (ctx, count: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const createdExhibitions = await createExhibitionsForTest(apiServer, scenarioContext.adminToken, count, 'list_exhibition');
        Object.assign(context, { createdExhibitions });
      });

      When('list exhibitions with limit {int} and offset {int}', async (ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('return {int} exhibitions', (ctx, count: number) => {
        expect(context.listResult.data).toHaveLength(count);
      });

      And('the exhibition is the second created exhibition', () => {
        expect(context.listResult.data[0].id).toBe(context.createdExhibitions[1].id);
      });
    }
  );

  Scenario(
    'list exhibitions empty result',
    (s: StepTest<{
      listResult: ExhibitionListResponse
    }>) => {
      const { When, Then, context } = s;

      When('list exhibitions with limit {int} and offset {int}', async (ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('return {int} exhibitions', (ctx, count: number) => {
        expect(context.listResult.data).toHaveLength(count);
      });
    }
  );

  Scenario.skip(
    'non-admin user cannot create exhibition',
    (s: StepTest<{
      draftExhibition: DraftExhibition;
      regularUserToken?: string;
      lastError?: unknown;
    }>) => {
      const { Given, When, Then, context } = s;

      Given('a regular user is logged in', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('try to create exhibition with name {string}', async (ctx, name: string) => {
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
            location: 'Test Location'
          }
        });

        try {
          await createExhibition(apiServer, context.regularUserToken, context.draftExhibition);
        } catch (error) {
          Object.assign(context, { lastError: error });
        }
      });

      Then('permission denied error is returned', () => {
        expect(context.lastError).toBeTruthy();
        expect(context.lastError).toBeInstanceOf(APIError);
        const apiError = context.lastError as APIError;
        expect(apiError.status).toBe(403);
      });
    }
  );

  Scenario.skip(
    'non-admin user cannot add ticket category to exhibition',
    (s: StepTest<{
      exhibition: ExhibitionType;
      draftTicket: DraftTicket;
      regularUserToken?: string;
      lastError?: unknown;
    }>) => {
      const { Given, When, Then, context } = s;

      Given('created exhibition by admin', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitionsForTest(apiServer, scenarioContext.adminToken, 1, 'test_exhibition');
        Object.assign(context, { exhibition });
      });

      Given('a regular user is logged in', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('try to add ticket category to exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        Object.assign(context, {
          draftTicket: {
            name: 'unauthorized_ticket',
            price: 100,
            valid_duration_days: 1,
            refund_policy: 'NON_REFUNDABLE',
            admittance: 1
          }
        });

        try {
          await addTicketCategory(
            apiServer,
            context.regularUserToken,
            context.exhibition.id,
            context.draftTicket,
          );
        } catch (error) {
          Object.assign(context, { lastError: error });
        }
      });

      Then('permission denied error is returned', () => {
        expect(context.lastError).toBeTruthy();
        expect(context.lastError).toBeInstanceOf(APIError);
        const apiError = context.lastError as APIError;
        expect(apiError.status).toBe(403);
      });
    }
  );
});
