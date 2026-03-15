import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, vi } from 'vitest';
import { Exhibition, Inventory } from '@cr7/types';
import { FixturesResult, useFixtures } from './lib/fixtures.js';
import { services_fixtures } from './fixtures/services.js';
import {
  assertSessionTickets,
  getSessionTickets,
  updateTicketCategoryMaxInventory,
} from './fixtures/inventory.js';
import {
  prepareInventoryExhibitionData,
  prepareInventoryTicketData,
} from './fixtures/exhibition.js';

const schema = 'test_inventory';
const services = ['api', 'cr7'];

const feature = await loadFeature('tests/features/inventory.feature');

type ExhibitionType = Exhibition.Exhibition;
type SessionType = Exhibition.Session;
type TicketCategoryType = Exhibition.TicketCategory;
type SessionTicketsInventoryType = Inventory.SessionTicketsInventory;

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
    'view inventory of a session',
    (s: StepTest<{
      exhibition: ExhibitionType;
      sessions: SessionType[];
      ticketCategories: TicketCategoryType[];
      inventory: SessionTicketsInventoryType[];
    }>) => {
      const { Given, And, When, Then, context } = s;
      prepareInventoryExhibitionData(Given, scenarioContext, context);
      prepareInventoryTicketData(And, scenarioContext, context);

      Given('a session with inventory', () => {
        expect(context.sessions).toHaveLength(2);
      });

      When('view inventory of the session', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const session = context.sessions[0];
        const inventory = await getSessionTickets(apiServer, context.exhibition.id, session.id);
        Object.assign(context, { inventory });
      });

      Then('the inventory of all ticket categories in the session are empty by default', () => {
        expect(context.inventory).toHaveLength(2);
        context.inventory.forEach(assertSessionTickets);
        expect(context.inventory.every(item => item.quantity === 0)).toBe(true);
      });
    }
  );

  Scenario(
    '可以一次更新 exhibition 下某个 ticket category 所有 session 的 inventory',
    (s: StepTest<{
      exhibition: ExhibitionType;
      sessions: SessionType[];
      ticketCategories: TicketCategoryType[];
    }>) => {
      const { Given, When, Then, And, context } = s;
      prepareInventoryExhibitionData(Given, scenarioContext, context);
      prepareInventoryTicketData(And, scenarioContext, context);

      Given(
        'inventory quantity 50 for ticket category {string} in all sessions of the exhibition',
        async (_ctx, name: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === name);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            context.exhibition.id,
            category!.id,
            50
          );
        }
      );

      When(
        'update inventory of ticket category {string} in all sessions of the exhibition',
        async (_ctx, name: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === name);
          expect(category).toBeTruthy();
          await expect(updateTicketCategoryMaxInventory(
            apiServer,
            context.exhibition.id,
            category!.id,
            50
          )).resolves.toBeNull();
        }
      );

      Then(
        'the inventory of ticket category {string} in all sessions of the exhibition is {int}',
        async (_ctx, categoryName: string, expectedQuantity: number) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === categoryName);
          expect(category).toBeTruthy();

          for (const session of context.sessions) {
            const inventory = await getSessionTickets(apiServer, context.exhibition.id, session.id);
            const item = inventory.find(row => row.id === category!.id);
            expect(item?.quantity).toBe(expectedQuantity);
          }
        }
      );

      And(
        'the inventory of another ticket category {string} in all sessions of the exhibition is still {int}',
        async (_ctx, categoryName: string, expectedQuantity: number) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === categoryName);
          expect(category).toBeTruthy();

          for (const session of context.sessions) {
            const inventory = await getSessionTickets(apiServer, context.exhibition.id, session.id);
            const item = inventory.find(row => row.id === category!.id);
            expect(item?.quantity).toBe(expectedQuantity);
          }
        }
      );
    }
  );

  Scenario(
    '可以查看 一个 session 下所有 ticket category 的 inventory',
    (s: StepTest<{
      exhibition: ExhibitionType;
      sessions: SessionType[];
      ticketCategories: TicketCategoryType[];
      inventory: SessionTicketsInventoryType[];
    }>) => {
      const { Given, When, Then, And, context } = s;
      prepareInventoryExhibitionData(Given, scenarioContext, context);
      prepareInventoryTicketData(And, scenarioContext, context);

      Given(
        'inventory quantity {int} for ticket category {string} in the first session of the exhibition',
        async (_ctx, quantity: number, categoryName: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            context.exhibition.id,
            category!.id,
            quantity
          );
        }
      );

      Given(
        'inventory quantity 20 for ticket category {string} in the first session of the exhibition',
        async (_ctx, categoryName: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            context.exhibition.id,
            category!.id,
            20
          );
        }
      );

      When('view inventory of the first session of the exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const firstSession = context.sessions[0];
        const inventory = await getSessionTickets(apiServer, context.exhibition.id, firstSession.id);
        Object.assign(context, { inventory });
      });

      Then(
        'the inventory of ticket category {string} in the first session of the exhibition is {int}',
        (_ctx, categoryName: string, expectedQuantity: number) => {
          const category = context.ticketCategories.find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          const item = context.inventory.find(row => row.id === category!.id);
          expect(item).toBeDefined();
          expect(item!.quantity).toBe(expectedQuantity);
        }
      );

      And(
        'the inventory of ticket category {string} in the first session of the exhibition is 20',
        (_ctx, categoryName: string) => {
          const category = context.ticketCategories?.find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          const item = context.inventory.find(row => row.id === category!.id);
          expect(item).toBeDefined();
          expect(item!.quantity).toBe(20);
        }
      );
    }
  );
});
