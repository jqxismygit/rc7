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
  assertExhibition,
  assertSession,
  assertTicketCategory,
  prepareExhibitionData
} from './fixtures/exhibition.js';

const schema = 'test_exhibition';
const services = ['api', 'cr7'];

const feature = await loadFeature('tests/features/exhibition.feature');

type ExhibitionType = Exhibition.Exhibition;
type SessionType = Exhibition.Session;
type TicketCategory = Exhibition.TicketCategory;
type DraftExhibition = Omit<ExhibitionType, 'id' | 'created_at' | 'updated_at'>;
type DraftTicket = Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>;

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  currentUser?: { id: string; role: string };
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
    Given('a user with role admin is logged in', () => {
      scenarioContext.currentUser = { id: 'admin_user_1', role: 'admin' };
      expect(scenarioContext.currentUser.role).toBe('admin');
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
        const exhibition = await createExhibition(apiServer, draftExhibition);
        Object.assign(context, { exhibition });
      });

      Then('exhibition created successfully with empty ticket categories', async () => {
        const { exhibition } = context;
        expect(exhibition).toBeTruthy();
        assertExhibition(exhibition);
        expect(exhibition.name).toBe('cr7_life_museum');

        // Verify ticket categories are empty by querying separately
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, exhibition.id);
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
      prepareExhibitionData(Given, scenarioContext, context);

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
          exhibition!.id,
          draftTicket
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

      And('exhibition has {int} ticket category {string}', async (ctx, count: number, categoryName: string) => {
        const { exhibition, ticket } = context;
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, exhibition!.id);
        expect(categories).toHaveLength(count);
        expect(categories.some(t => t.name === categoryName)).toBe(true);
        expect(categories[0]).toMatchObject(ticket);
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
      prepareExhibitionData(Given, scenarioContext, context);

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
          exhibition!.id,
          draftTicket as Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
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
        const { exhibition, ticket } = context;
        const { apiServer } = scenarioContext.fixtures.values;
        const categories = await getTicketCategories(apiServer, exhibition!.id);
        expect(categories).toHaveLength(count);
        expect(categories[0].name).toEqual(name);
        expect(categories[0]).toMatchObject(ticket);
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
      prepareExhibitionData(Given, scenarioContext, context);

      Then('exhibition has daily sessions by default', async () => {
        const { exhibition } = context;
        const { apiServer } = scenarioContext.fixtures.values;
        const sessions = await getSessions(apiServer, exhibition.id);

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
});
