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
  prepareEarlyBirdTicketCategory,
  prepareExhibitionWithSessions,
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

type ExhibitionContext = {
  exhibition?: ExhibitionType;
};

type SessionsContext = {
  sessions?: SessionType[];
};

type TicketCategoriesContext = {
  ticketCategories?: TicketCategoryType[];
};

type InventoryResultContext = {
  inventory?: SessionTicketsInventoryType[];
};

type ErrorContext = {
  lastError?: unknown;
};

type RegularUserContext = {
  regularUserToken?: string;
};

type InventoryBaseScenarioContext = ExhibitionContext & SessionsContext & TicketCategoriesContext;
type InventoryViewScenarioContext = InventoryBaseScenarioContext & InventoryResultContext;
type UnauthorizedInventoryScenarioContext = InventoryBaseScenarioContext & RegularUserContext & ErrorContext;

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
  function requireExhibition(context: ExhibitionContext) {
    expect(context.exhibition).toBeTruthy();
    return context.exhibition!;
  }

  function requireSessions(context: SessionsContext) {
    expect(context.sessions).toBeTruthy();
    return context.sessions!;
  }

  function requireTicketCategories(context: TicketCategoriesContext) {
    expect(context.ticketCategories).toBeTruthy();
    return context.ticketCategories!;
  }

  function requireInventory(context: InventoryResultContext) {
    expect(context.inventory).toBeTruthy();
    return context.inventory!;
  }

  function assertPermissionDenied(error: unknown) {
    expect(error).toBeTruthy();
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).status).toBe(403);
  }

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
    token: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const { exhibition, sessions } = await prepareExhibitionWithSessions(apiServer, token);

    Object.assign(context, {
      exhibition,
      sessions,
    });
  }

  async function prepareInventoryTicketData(
    context: ExhibitionContext & TicketCategoriesContext,
    token: string,
  ) {
    const { apiServer } = scenarioContext.fixtures.values;
    const eid = requireExhibition(context).id;
    const ticketCategories = [
      await prepareEarlyBirdTicketCategory(apiServer, token, eid),
      await prepareRegularTicketCategory(apiServer, token, eid),
    ]
    Object.assign(context, {
      ticketCategories,
    });
  }

  Scenario(
    'view inventory of a session',
    (s: StepTest<InventoryViewScenarioContext>) => {
      const { Given, And, When, Then, context } = s;

      Given('created exhibition with 2 sessions', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('created 2 ticket categories for the exhibition', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given('a session with inventory', () => {
        expect(requireSessions(context)).toHaveLength(2);
      });

      When('view inventory of the session', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const session = requireSessions(context)[0];
        const inventory = await getSessionTickets(
          apiServer,
          scenarioContext.adminToken,
          requireExhibition(context).id,
          session.id,
        );
        Object.assign(context, { inventory });
      });

      Then('the inventory of all ticket categories in the session are empty by default', () => {
        const inventory = requireInventory(context);
        expect(inventory).toHaveLength(2);
        inventory.forEach(assertSessionTickets);
        expect(inventory.every(item => item.quantity === 0)).toBe(true);
      });
    }
  );

  Scenario(
    '可以一次更新 exhibition 下某个 ticket category 所有 session 的 inventory',
    (s: StepTest<InventoryBaseScenarioContext>) => {
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
          const category = requireTicketCategories(context).find(item => item.name === name);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            scenarioContext.adminToken,
            requireExhibition(context).id,
            category!.id,
            50,
          );
        }
      );

      When(
        'update inventory of ticket category {string} in all sessions of the exhibition',
        async (_ctx, name: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = requireTicketCategories(context).find(item => item.name === name);
          expect(category).toBeTruthy();
          await expect(
            updateTicketCategoryMaxInventory(
              apiServer,
              scenarioContext.adminToken,
              requireExhibition(context).id,
              category!.id,
              50,
            ),
          ).resolves.toBeNull();
        }
      );

      Then(
        'the inventory of ticket category {string} in all sessions of the exhibition is {int}',
        async (_ctx, categoryName: string, expectedQuantity: number) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();

          for (const session of requireSessions(context)) {
            const inventory = await getSessionTickets(
              apiServer,
              scenarioContext.adminToken,
              requireExhibition(context).id,
              session.id,
            );
            const item = inventory.find(row => row.id === category!.id);
            expect(item?.quantity).toBe(expectedQuantity);
          }
        }
      );

      And(
        'the inventory of another ticket category {string} in all sessions of the exhibition is still {int}',
        async (_ctx, categoryName: string, expectedQuantity: number) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();

          for (const session of requireSessions(context)) {
            const inventory = await getSessionTickets(
              apiServer,
              scenarioContext.adminToken,
              requireExhibition(context).id,
              session.id,
            );
            const item = inventory.find(row => row.id === category!.id);
            expect(item?.quantity).toBe(expectedQuantity);
          }
        }
      );
    }
  );

  Scenario(
    '可以查看 一个 session 下所有 ticket category 的 inventory',
    (s: StepTest<InventoryViewScenarioContext>) => {
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
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            scenarioContext.adminToken,
            requireExhibition(context).id,
            category!.id,
            quantity,
          );
        }
      );

      Given(
        'inventory quantity 20 for ticket category {string} in the first session of the exhibition',
        async (_ctx, categoryName: string) => {
          const { apiServer } = scenarioContext.fixtures.values;
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            scenarioContext.adminToken,
            requireExhibition(context).id,
            category!.id,
            20,
          );
        }
      );

      When('view inventory of the first session of the exhibition', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const firstSession = requireSessions(context)[0];
        const inventory = await getSessionTickets(
          apiServer,
          scenarioContext.adminToken,
          requireExhibition(context).id,
          firstSession.id,
        );
        Object.assign(context, { inventory });
      });

      Then(
        'the inventory of ticket category {string} in the first session of the exhibition is {int}',
        (_ctx, categoryName: string, expectedQuantity: number) => {
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          const item = requireInventory(context).find(row => row.id === category!.id);
          expect(item).toBeDefined();
          expect(item!.quantity).toBe(expectedQuantity);
        }
      );

      And(
        'the inventory of ticket category {string} in the first session of the exhibition is 20',
        (_ctx, categoryName: string) => {
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          const item = requireInventory(context).find(row => row.id === category!.id);
          expect(item).toBeDefined();
          expect(item!.quantity).toBe(20);
        }
      );
    }
  );

  Scenario(
    'non-admin user cannot update inventory',
    (s: StepTest<UnauthorizedInventoryScenarioContext>) => {
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
            requireExhibition(context).id,
            requireTicketCategories(context)[0].id,
            50,
          );
        } catch (error) {
          Object.assign(context, { lastError: error });
        }
      });

      Then('permission denied error is returned', () => {
        assertPermissionDenied(context.lastError);
      });
    }
  );
});
