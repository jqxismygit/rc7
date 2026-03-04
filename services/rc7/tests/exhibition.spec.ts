import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, TestContext, vi } from 'vitest';
import { Exhibition } from '@rc7/types';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import {
  createExhibition,
  addTicketCategory,
  assertExhibitionWithCategories,
  assertTicketCategory
} from './fixtures/exhibition.js';

const schema = 'test_exhibition';
const services = ['api', 'rc7'];

const feature = await loadFeature('tests/features/exhibition.feature');

type ExhibitionType = Exhibition.Exhibition;
type TicketCategory = Exhibition.TicketCategory;
type ExhibitionWithCategories = Exhibition.ExhibitionWithCategories;

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  currentUser?: { id: string; role: string };
}

interface ExhibitionStepContext extends TestContext {
  draftExhibition?: Omit<ExhibitionType, 'id' | 'created_at' | 'updated_at'>;
  currentExhibition?: ExhibitionWithCategories;
  draftCategory?: Partial<Omit<TicketCategory, 'exhibit_id' | 'id' | 'created_at' | 'updated_at'>>;
  addedCategory?: TicketCategory;
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
    ({ Given, When, Then, And, context }: StepTest<ExhibitionStepContext>) => {
      Given('exhibition name {word}', (ctx, name: string) => {
        Object.assign(context, {
          draftExhibition: {
            name,
            description: '',
            start_date: '',
            end_date: '',
            opening_time: '',
            closing_time: '',
            last_entry_time: '',
            location: ''
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
        context.currentExhibition = exhibition;
      });

      Then('exhibition created successfully with empty ticket categories', () => {
        const { currentExhibition } = context;
        expect(currentExhibition).toBeTruthy();
        assertExhibitionWithCategories(currentExhibition);
        expect(currentExhibition?.ticket_categories).toEqual([]);
        expect(currentExhibition?.name).toBe('cr7_life_museum');
      });
    }
  );

  Scenario(
    'add new ticket category to exhibition',
    ({ Given, When, Then, And, context }: StepTest<ExhibitionStepContext>) => {
      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const exhibition = await createExhibition(apiServer, {
          name: 'test_exhibition',
          description: 'Test exhibition for tickets',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Test Location'
        });
        context.currentExhibition = exhibition;
      });

      When('add ticket category {string} to exhibition', (ctx, categoryName: string) => {
        Object.assign(context, {
          draftCategory: {
            name: categoryName
          }
        });
      });

      And('price {int}', (ctx, price: number) => {
        context.draftCategory.price = price;
      });

      And('valid duration {int} day', (ctx, days: number) => {
        context.draftCategory.valid_duration_days = days;
      });

      And('refund policy non refundable', () => {
        context.draftCategory.refund_policy = 'NON_REFUNDABLE';
      });
      And('admittance {int} person', (ctx, count: number) => {
        context.draftCategory.admittance = count;
      });

      Then('ticket category to exhibition {string} added successfully', async (ctx, categoryName: string) => {
        const { currentExhibition, draftCategory } = context;
        expect(currentExhibition).toBeTruthy();
        expect(draftCategory).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const category = await addTicketCategory(
          apiServer,
          currentExhibition!.id,
          draftCategory as Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
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
    ({ Given, When, Then, And, context }: StepTest<ExhibitionStepContext>) => {
      Given('created exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const exhibition = await createExhibition(apiServer, {
          name: 'test_exhibition_2',
          description: 'Test exhibition for multiple categories',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Test Location'
        });
        context.currentExhibition = exhibition;
      });

      When('add ticket category {string} to exhibition', (ctx, categoryName: string) => {
        Object.assign(context, {
          draftCategory: {
            name: categoryName
          }
        });
      });

      And('price {int}', (ctx, price: number) => {
        context.draftCategory.price = price;
      });
      And('valid duration {int} day', (ctx, days: number) => {
        context.draftCategory.valid_duration_days = days;
      });
      And('refund policy refundable until 48 hours before the event', () => {
        context.draftCategory.refund_policy = 'REFUNDABLE_48H_BEFORE';
      });
      And('admittance {int} person', (ctx, count: number) => {
        context.draftCategory.admittance = count;
      });

      Then('ticket category to exhibition {string} added successfully', async (ctx, categoryName: string) => {
        const { currentExhibition, draftCategory } = context;
        expect(currentExhibition).toBeTruthy();
        expect(draftCategory).toBeTruthy();

        const { apiServer } = scenarioContext.fixtures.values;
        const category = await addTicketCategory(
          apiServer,
          currentExhibition!.id,
          draftCategory as Omit<TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
        );

        // 验证
        assertTicketCategory(category);
        expect(category.name).toBe(categoryName);
        expect(category.price).toBe(150);
        expect(category.valid_duration_days).toBe(10);
        expect(category.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
        expect(category.admittance).toBe(2);
      });
    }
  );
});