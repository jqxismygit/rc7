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

type CreateExhibitionScenarioContext = {
  draftExhibition: DraftExhibition;
  exhibition: ExhibitionType;
};

type TicketCategoryScenarioContext = {
  exhibition: ExhibitionType;
  draftTicket: DraftTicket;
  ticket: TicketCategory;
};

type SessionsScenarioContext = {
  exhibition: ExhibitionType;
  sessions: SessionType[];
};

type ExhibitionListScenarioContext = {
  createdExhibitions: ExhibitionType[];
  listResult: ExhibitionListResponse;
};

type PermissionErrorContext = {
  lastError?: unknown;
};

type NonAdminCreateScenarioContext = PermissionErrorContext & {
  draftExhibition: DraftExhibition;
  regularUserToken?: string;
};

type NonAdminAddTicketScenarioContext = PermissionErrorContext & {
  exhibition: ExhibitionType;
  draftTicket: DraftTicket;
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
    (s: StepTest<CreateExhibitionScenarioContext>) => {
      const { Given, When, Then, And, context } = s;
      Given('exhibition name {word}', (_ctx, name: string) => {
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

      And('description {string}', (_ctx, description: string) => {
        context.draftExhibition.description = description;
      });

      And('start date {string}', (_ctx, startDate: string) => {
        context.draftExhibition.start_date = startDate;
      });

      And('end date {string}', (_ctx, endDate: string) => {
        context.draftExhibition.end_date = endDate;
      });

      And('opening time {string}', (_ctx, openingTime: string) => {
        context.draftExhibition.opening_time = openingTime;
      });

      And('closing time {string}', (_ctx, closingTime: string) => {
        context.draftExhibition.closing_time = closingTime;
      });

      And('last entry time {string}', (_ctx, lastEntryTime: string) => {
        context.draftExhibition.last_entry_time = lastEntryTime;
      });

      And('location {string}', (_ctx, location: string) => {
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

      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        Object.assign(context, { exhibition });
      });

      Given('draft ticket category {string} to exhibition', (_ctx, categoryName: string) => {
        Object.assign(context, { draftTicket: { name: categoryName } });
      });

      And('price {int}', (_ctx, price: number) => {
        context.draftTicket.price = price;
      });

      And('valid duration {int} day', (_ctx, days: number) => {
        context.draftTicket.valid_duration_days = days;
      });

      And('refund policy non refundable', () => {
        context.draftTicket.refund_policy = 'NON_REFUNDABLE';
      });

      And('admittance {int} person', (_ctx, count: number) => {
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
          exhibition.id,
          draftTicket,
        );

        Object.assign(context, { ticket: category });
      });

      Then('ticket {string} added successfully', (_ctx, categoryName: string) => {
        assertTicketCategory(context.ticket);
        expect(context.ticket.name).toBe(categoryName);
        expect(context.ticket.price).toBe(100);
        expect(context.ticket.valid_duration_days).toBe(1);
        expect(context.ticket.refund_policy).toBe('NON_REFUNDABLE');
        expect(context.ticket.admittance).toBe(1);
      });

      And('exhibition has {int} ticket categories {string}', async (_ctx, count: number, categoryName: string) => {
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
    (s: StepTest<TicketCategoryScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
        Object.assign(context, { exhibition });
      });

      Given('draft ticket category {string} to exhibition', (_ctx, categoryName: string) => {
        Object.assign(context, { draftTicket: { name: categoryName } });
      });

      And('price {int}', (_ctx, price: number) => {
        context.draftTicket.price = price;
      });

      And('valid duration {int} day', (_ctx, days: number) => {
        context.draftTicket.valid_duration_days = days;
      });

      And('refund policy refundable until 48 hours before the event', () => {
        context.draftTicket.refund_policy = 'REFUNDABLE_48H_BEFORE';
      });

      And('admittance {int} person', (_ctx, count: number) => {
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
          exhibition.id,
          draftTicket,
        );

        Object.assign(context, { ticket });
      });

      Then('ticket {string} added successfully', (_ctx, categoryName: string) => {
        assertTicketCategory(context.ticket);
        expect(context.ticket.name).toBe(categoryName);
        expect(context.ticket.price).toBe(150);
        expect(context.ticket.valid_duration_days).toBe(10);
        expect(context.ticket.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
        expect(context.ticket.admittance).toBe(2);
      });

      And(
        'exhibition has {int} ticket categories {string}',
        async (_ctx, count: number, name: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const categories = await getTicketCategories(apiServer, context.exhibition.id, scenarioContext.adminToken);
          expect(categories).toHaveLength(count);
          expect(categories.some(item => item.name === name)).toBe(true);
          expect(categories[0]).toMatchObject(context.ticket);
        },
      );
    }
  );

  Scenario(
    'sessions was created when exhibition was created',
    (s: StepTest<SessionsScenarioContext>) => {
      const { Given, Then, And, context } = s;

      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
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
    (s: StepTest<ExhibitionListScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('created {int} exhibitions for listing', async (_ctx, count: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        Object.assign(context, { createdExhibitions });
      });

      When('list exhibitions with limit {int} and offset {int}', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('return {int} exhibitions', (_ctx, count: number) => {
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
    (s: StepTest<ExhibitionListScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('created {int} exhibitions for listing', async (_ctx, count: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const createdExhibitions = await createExhibitions(apiServer, scenarioContext.adminToken, count, {
          namePrefix: 'list_exhibition',
        });
        Object.assign(context, { createdExhibitions });
      });

      When('list exhibitions with limit {int} and offset {int}', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('return {int} exhibitions', (_ctx, count: number) => {
        expect(context.listResult.data).toHaveLength(count);
      });

      And('the exhibition is the second created exhibition', () => {
        expect(context.listResult.data[0].id).toBe(context.createdExhibitions[1].id);
      });
    }
  );

  Scenario(
    'list exhibitions empty result',
    (s: StepTest<Pick<ExhibitionListScenarioContext, 'listResult'>>) => {
      const { When, Then, context } = s;

      When('list exhibitions with limit {int} and offset {int}', async (_ctx, limit: number, offset: number) => {
        const { apiServer } = scenarioContext.fixtures.values;
        const listResult = await listExhibitions(apiServer, scenarioContext.adminToken, { limit, offset });
        Object.assign(context, { listResult });
      });

      Then('return {int} exhibitions', (_ctx, count: number) => {
        expect(context.listResult.data).toHaveLength(count);
      });
    }
  );

  Scenario(
    'non-admin user cannot create exhibition',
    (s: StepTest<NonAdminCreateScenarioContext>) => {
      const { Given, When, Then, context } = s;

      Given('a regular user is logged in', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('try to create exhibition with name {string}', async (_ctx, name: string) => {
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
          await createExhibition(apiServer, context.regularUserToken, context.draftExhibition);
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('permission denied error is returned', () => {
        assertPermissionDenied(context.lastError);
      });
    }
  );

  Scenario(
    'non-admin user cannot add ticket category to exhibition',
    (s: StepTest<NonAdminAddTicketScenarioContext>) => {
      const { Given, When, Then, context } = s;

      Given('created exhibition by admin', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const [exhibition] = await createExhibitions(apiServer, scenarioContext.adminToken, 1);
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
            admittance: 1,
          },
        });

        try {
          await addTicketCategory(
            apiServer,
            context.regularUserToken,
            context.exhibition.id,
            context.draftTicket,
          );
        } catch (error) {
          rememberError(context, error);
        }
      });

      Then('permission denied error is returned', () => {
        assertPermissionDenied(context.lastError);
      });
    }
  );
});
