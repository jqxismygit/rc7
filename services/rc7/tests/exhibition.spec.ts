import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, vi } from 'vitest';
import { Exhibition } from '@rc7/types';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import {
  createExhibition,
  addTicketCategory,
  assertExhibitionWithCategories,
  assertTicketCategory,
  prepareExhibitionData
} from './fixtures/exhibition.js';

const schema = 'test_exhibition';
const services = ['api', 'rc7'];

const feature = await loadFeature('tests/features/exhibition.feature');

type ExhibitionType = Exhibition.Exhibition;
type TicketCategory = Exhibition.TicketCategory;
type ExhibitionWithCategories = Exhibition.ExhibitionWithCategories;
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
    (s: StepTest<{ draftExhibition: DraftExhibition, exhibition: ExhibitionWithCategories }>) => {
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

      Then('exhibition created successfully with empty ticket categories', () => {
        const { exhibition } = context;
        expect(exhibition).toBeTruthy();
        assertExhibitionWithCategories(exhibition);
        expect(exhibition.ticket_categories).toEqual([]);
        expect(exhibition.name).toBe('cr7_life_museum');
      });
    }
  );

  Scenario(
    'add new ticket category to exhibition',
    (s: StepTest<{ exhibition: ExhibitionWithCategories, draftTicket: DraftTicket }>) => {
      const { Given, When, Then, And, context } = s;
      prepareExhibitionData(Given, scenarioContext, context);

      When('add ticket category {string} to exhibition', (ctx, categoryName: string) => {
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

      Then('ticket category to exhibition {string} added successfully', async (ctx, categoryName: string) => {
        const { exhibition, draftTicket } = context;
        expect(exhibition).toBeTruthy();
        expect(draftTicket).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const category = await addTicketCategory(
          apiServer,
          exhibition!.id,
          draftTicket
        );

        // 验证
        assertTicketCategory(category);
        expect(category.name).toBe(categoryName);
        expect(category.price).toBe(100);
        expect(category.valid_duration_days).toBe(1);
        expect(category.refund_policy).toBe('NON_REFUNDABLE');
        expect(category.admittance).toBe(1);
      });
    }
  );

  Scenario(
    'add another ticket category to exhibition',
    (s: StepTest<{ exhibition: ExhibitionWithCategories; draftTicket: DraftTicket }>) => {
      const { Given, When, Then, And, context } = s;
      prepareExhibitionData(Given, scenarioContext, context);

      When('add ticket category {string} to exhibition', (ctx, name: string) => {
        Object.assign(context, { draftTicket: { name }});
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

      Then('ticket category to exhibition {string} added successfully', async (ctx, categoryName: string) => {
        const { exhibition, draftTicket } = context;
        expect(exhibition).toBeTruthy();
        expect(draftTicket).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const ticket = await addTicketCategory(
          apiServer,
          exhibition!.id,
          draftTicket as Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
        );

        // 验证
        assertTicketCategory(ticket);
        expect(ticket.name).toBe(categoryName);
        expect(ticket.price).toBe(150);
        expect(ticket.valid_duration_days).toBe(10);
        expect(ticket.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
        expect(ticket.admittance).toBe(2);
      });
    }
  );
});