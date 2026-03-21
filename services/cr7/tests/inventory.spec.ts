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
  getSessions,
  prepareEarlyBirdTicketCategory,
  prepareExhibition,
  prepareRegularTicketCategory,
} from './fixtures/exhibition.js';
import { registerUser, prepareAdminToken } from './fixtures/user.js';
import { APIError } from './lib/api.js';

const schema = 'test_inventory';
const services = ['api', 'cr7', 'user'];

const feature = await loadFeature('tests/features/inventory.feature');

type ExhibitionType = Exhibition.Exhibition;
type SessionType = Exhibition.Session;
type TicketCategoryType = Exhibition.TicketCategory;
type SessionTicketsInventoryType = Inventory.SessionTicketsInventory;

interface ScenarioContext {
  fixtures: FixturesResult<typeof services_fixtures, 'apiServer'>;
  adminToken: string;
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

  async function prepareInventoryExhibitionData(
    context: { exhibition?: ExhibitionType; sessions?: SessionType[] },
    token?: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;

    const exhibition = await prepareExhibition(apiServer, token);
    const sessions = await getSessions(apiServer, exhibition.id, token);

    Object.assign(context, {
      exhibition,
      sessions,
    });
  }

  async function prepareInventoryTicketData(
    context: { exhibition?: ExhibitionType; ticketCategories?: TicketCategoryType[] },
    token: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    expect(context.exhibition).toBeTruthy();

    const earlyBird = await prepareEarlyBirdTicketCategory(apiServer, token, context.exhibition!.id)
    const regular = await prepareRegularTicketCategory(apiServer, token, context.exhibition!.id);

    Object.assign(context, {
      ticketCategories: [earlyBird, regular],
    });
  }

  Scenario(
    'view inventory of a session',
    (s: StepTest<{
      exhibition: ExhibitionType;
      sessions: SessionType[];
      ticketCategories: TicketCategoryType[];
      inventory: SessionTicketsInventoryType[];
    }>) => {
      const { Given, And, When, Then, context } = s;
      Given('created exhibition with 2 sessions', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('created 2 ticket categories for the exhibition', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given('a session with inventory', () => {
        expect(context.sessions).toHaveLength(2);
      });

      When('view inventory of the session', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const session = context.sessions[0];
        const inventory = await getSessionTickets(apiServer, scenarioContext.adminToken, context.exhibition.id, session.id);
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
      Given('created exhibition with 2 sessions', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('created 2 ticket categories for the exhibition', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given(
        'inventory quantity 50 for ticket category {string} in all sessions of the exhibition',
        async (_ctx, name: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === name);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            scenarioContext.adminToken,
            context.exhibition.id,
            category!.id,
            50,
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
            scenarioContext.adminToken,
            context.exhibition.id,
            category!.id,
            50,
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
            const inventory = await getSessionTickets(apiServer, scenarioContext.adminToken, context.exhibition.id, session.id);
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
            const inventory = await getSessionTickets(apiServer, scenarioContext.adminToken, context.exhibition.id, session.id);
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
      Given('created exhibition with 2 sessions', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('created 2 ticket categories for the exhibition', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given(
        'inventory quantity {int} for ticket category {string} in the first session of the exhibition',
        async (_ctx, quantity: number, categoryName: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = context.ticketCategories.find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            scenarioContext.adminToken,
            context.exhibition.id,
            category!.id,
            quantity,
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
            scenarioContext.adminToken,
            context.exhibition.id,
            category!.id,
            20,
          );
        }
      );

      When('view inventory of the first session of the exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const firstSession = context.sessions[0];
        const inventory = await getSessionTickets(apiServer, scenarioContext.adminToken, context.exhibition.id, firstSession.id);
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

  Scenario(
    'non-admin user cannot update inventory',
    (s: StepTest<{
      exhibition: ExhibitionType;
      sessions: SessionType[];
      ticketCategories: TicketCategoryType[];
      regularUserToken?: string;
      lastError?: unknown;
    }>) => {
      const { Given, When, Then, And, context } = s;
      Given('created exhibition with 2 sessions by admin', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('created 2 ticket categories for the exhibition by admin', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given('a regular user is logged in', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('try to update inventory of ticket category', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        try {
          await updateTicketCategoryMaxInventory(
            apiServer,
            context.regularUserToken,
            context.exhibition.id,
            context.ticketCategories[0].id,
            50,
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
