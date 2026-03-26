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
  prepareExhibitionWithSessions,
  prepareTicketCategory,
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
    Given('系统管理员已经创建并登录', async () => {
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
      await prepareTicketCategory(apiServer, token, eid, {
        name: 'early_bird',
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
        admittance: 1,
      }),
      await prepareTicketCategory(apiServer, token, eid, {
        name: 'regular',
        price: 150,
        refund_policy: 'REFUNDABLE_48H_BEFORE',
      }),
    ]
    Object.assign(context, {
      ticketCategories,
    });
  }

  Scenario(
    'view inventory of a session',
    (s: StepTest<InventoryViewScenarioContext>) => {
      const { Given, And, When, Then, context } = s;

      Given('已创建一个包含 2 个场次的展览', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('已为该展览创建 2 个票种', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given('场次库存已准备完成', () => {
        expect(requireSessions(context)).toHaveLength(2);
      });

      When('查看该场次的库存', async () => {
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

      Then('该场次下所有票种库存默认都为 0', () => {
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

      Given('已创建一个包含 2 个场次的展览', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('已为该展览创建 2 个票种', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given(
        '已将票种 {string} 在该展览所有场次的库存设置为 50',
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
        '更新票种 {string} 在该展览所有场次的库存',
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
        '票种 {string} 在该展览所有场次的库存应为 {int}',
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
        '另一票种 {string} 在该展览所有场次的库存应仍为 {int}',
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

      Given('已创建一个包含 2 个场次的展览', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('已为该展览创建 2 个票种', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given(
        '已将票种 {string} 在该展览首场次的库存设置为 {int}',
        async (_ctx, categoryName: string, quantity: number) => {
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

      And(
        '并将票种 {string} 在该展览首场次的库存设置为 {int}',
        async (_ctx, categoryName: string, quantity: number) => {
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

      When('查看该展览首场次的库存', async () => {
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
        '票种 {string} 在该展览首场次的库存应为 {int}',
        (_ctx, categoryName: string, expectedQuantity: number) => {
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          const item = requireInventory(context).find(row => row.id === category!.id);
          expect(item).toBeDefined();
          expect(item!.quantity).toBe(expectedQuantity);
        }
      );

      And(
        '另一票种 {string} 在该展览首场次的库存应为 {int}',
        (_ctx, categoryName: string, expectedQuantity: number) => {
          const category = requireTicketCategories(context).find(item => item.name === categoryName);
          expect(category).toBeTruthy();
          const item = requireInventory(context).find(row => row.id === category!.id);
          expect(item).toBeDefined();
          expect(item!.quantity).toBe(expectedQuantity);
        }
      );
    }
  );

  Scenario(
    'non-admin user cannot update inventory',
    (s: StepTest<UnauthorizedInventoryScenarioContext>) => {
      const { Given, When, Then, And, context } = s;

      Given('已创建一个包含 2 个场次的展览', async () => {
        await prepareInventoryExhibitionData(context, scenarioContext.adminToken);
      });

      And('已为该展览创建 2 个票种', async () => {
        await prepareInventoryTicketData(context, scenarioContext.adminToken);
      });

      Given('普通用户已登录', async () => {
        const { apiServer } = scenarioContext.fixtures.values;
        const regularUserToken = await registerUser(apiServer);
        Object.assign(context, { regularUserToken });
      });

      When('普通用户尝试更新票种库存', async () => {
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

      Then('返回权限不足错误', () => {
        assertPermissionDenied(context.lastError);
      });
    }
  );
});
