import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import config from 'config';
import { expect, vi } from 'vitest';
import { Exhibition, Inventory } from '@cr7/types';
import { ServiceBroker } from 'moleculer';
import { Server } from 'node:http';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import {
  assertSessionTickets,
  getSessionTickets,
  updateTicketCategoryMaxInventory,
} from './fixtures/inventory.js';
import { prepareExhibitionWithSessions, prepareTicketCategory } from './fixtures/exhibition.js';
import { registerUser, prepareAdminToken } from './fixtures/user.js';

const schema = 'test_inventory';
const services = ['api', 'cr7', 'user'];

const feature = await loadFeature('tests/features/inventory.feature');

type ExhibitionType = Exhibition.Exhibition;
type SessionType = Exhibition.Session;
type TicketCategoryType = Exhibition.TicketCategory;
type SessionTicketsPrice = Inventory.SessionTicketPrice;

interface FeatureContext {
  broker: ServiceBroker;
  apiServer: Server;
  adminToken: string;
  exhibition: ExhibitionType;
  sessions: SessionType[];
  ticketCategories: TicketCategoryType[];
}

describeFeature(
  feature,
  ({
    BeforeAllScenarios,
    AfterAllScenarios,
    AfterEachScenario,
    Background,
    Scenario,
    context: featureContext,
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

      Given('已创建一个包含 2 个场次的展览', async () => {
        const { apiServer } = featureContext;
        const { exhibition, sessions } = await prepareExhibitionWithSessions(
          apiServer,
          featureContext.adminToken
        );

        featureContext.exhibition = exhibition;
        featureContext.sessions = sessions;
      });

      Given('已为该展览创建 2 个票种', async () => {
        expect(featureContext.exhibition).toBeTruthy();
        const { apiServer } = featureContext;
        const eid = featureContext.exhibition.id;
        const ticketCategories = [
          await prepareTicketCategory(apiServer, featureContext.adminToken, eid, {
            name: 'early_bird',
            valid_duration_days: 1,
            refund_policy: 'NON_REFUNDABLE',
            admittance: 1,
          }),
          await prepareTicketCategory(apiServer, featureContext.adminToken, eid, {
            name: 'regular',
            price: 150,
            refund_policy: 'REFUNDABLE_48H_BEFORE',
          }),
        ];

        featureContext.ticketCategories = ticketCategories;
      });
    });

    Scenario(
      'view inventory of a session',
      (
        s: StepTest<{
          inventory?: SessionTicketsPrice[];
        }>
      ) => {
        const { Given, When, Then, context } = s;

        Given('场次库存已准备完成', () => {
          expect(featureContext.sessions).toHaveLength(2);
        });

        When('查看该场次的库存', async () => {
          const { apiServer } = featureContext;
          const session = featureContext.sessions[0];
          const inventory = await getSessionTickets(
            apiServer,
            featureContext.adminToken,
            featureContext.exhibition.id,
            session.id
          );
          context.inventory = inventory;
        });

        Then('该场次下所有票种库存默认都为 0', () => {
          const { inventory } = context;
          expect(inventory).toBeTruthy();
          expect(inventory).toHaveLength(2);
          inventory!.forEach(assertSessionTickets);
          expect(inventory!.every((item) => item.quantity === 0)).toBe(true);
        });
      }
    );

    Scenario(
      '可以一次更新 exhibition 下某个 ticket category 所有 session 的 inventory',
      (s: StepTest<void>) => {
        const { Given, When, Then, And } = s;

        Given('已将票种 {string} 在该展览所有场次的库存设置为 50', async (_ctx, name: string) => {
          const { apiServer } = featureContext;
          const category = featureContext.ticketCategories.find((item) => item.name === name);
          expect(category).toBeTruthy();
          await updateTicketCategoryMaxInventory(
            apiServer,
            featureContext.adminToken,
            featureContext.exhibition.id,
            category!.id,
            50
          );
        });

        When('更新票种 {string} 在该展览所有场次的库存', async (_ctx, name: string) => {
          const { apiServer } = featureContext;
          const category = featureContext.ticketCategories.find((item) => item.name === name);
          expect(category).toBeTruthy();
          await expect(
            updateTicketCategoryMaxInventory(
              apiServer,
              featureContext.adminToken,
              featureContext.exhibition.id,
              category!.id,
              50
            )
          ).resolves.toBeNull();
        });

        Then(
          '票种 {string} 在该展览所有场次的库存应为 {int}',
          async (_ctx, categoryName: string, expectedQuantity: number) => {
            const { apiServer } = featureContext;
            const category = featureContext.ticketCategories.find(
              (item) => item.name === categoryName
            );
            expect(category).toBeTruthy();

            for (const session of featureContext.sessions) {
              const inventory = await getSessionTickets(
                apiServer,
                featureContext.adminToken,
                featureContext.exhibition.id,
                session.id
              );
              const item = inventory.find((row) => row.id === category!.id);
              expect(item?.quantity).toBe(expectedQuantity);
            }
          }
        );

        And(
          '另一票种 {string} 在该展览所有场次的库存应仍为 {int}',
          async (_ctx, categoryName: string, expectedQuantity: number) => {
            const { apiServer } = featureContext;
            const category = featureContext.ticketCategories.find(
              (item) => item.name === categoryName
            );
            expect(category).toBeTruthy();

            for (const session of featureContext.sessions) {
              const inventory = await getSessionTickets(
                apiServer,
                featureContext.adminToken,
                featureContext.exhibition.id,
                session.id
              );
              const item = inventory.find((row) => row.id === category!.id);
              expect(item?.quantity).toBe(expectedQuantity);
            }
          }
        );
      }
    );

    Scenario(
      '可以查看 一个 session 下所有 ticket category 的 inventory',
      (
        s: StepTest<{
          inventory?: SessionTicketsPrice[];
        }>
      ) => {
        const { Given, When, Then, And, context } = s;

        Given(
          '已将票种 {string} 在该展览首场次的库存设置为 {int}',
          async (_ctx, categoryName: string, quantity: number) => {
            const { apiServer } = featureContext;
            const category = featureContext.ticketCategories.find(
              (item) => item.name === categoryName
            );
            expect(category).toBeTruthy();
            await updateTicketCategoryMaxInventory(
              apiServer,
              featureContext.adminToken,
              featureContext.exhibition.id,
              category!.id,
              quantity
            );
          }
        );

        And(
          '并将票种 {string} 在该展览首场次的库存设置为 {int}',
          async (_ctx, categoryName: string, quantity: number) => {
            const { apiServer } = featureContext;
            const category = featureContext.ticketCategories.find(
              (item) => item.name === categoryName
            );
            expect(category).toBeTruthy();
            await updateTicketCategoryMaxInventory(
              apiServer,
              featureContext.adminToken,
              featureContext.exhibition.id,
              category!.id,
              quantity
            );
          }
        );

        When('查看该展览首场次的库存', async () => {
          const { apiServer } = featureContext;
          const firstSession = featureContext.sessions[0];
          const inventory = await getSessionTickets(
            apiServer,
            featureContext.adminToken,
            featureContext.exhibition.id,
            firstSession.id
          );
          context.inventory = inventory;
        });

        Then(
          '票种 {string} 在该展览首场次的库存应为 {int}',
          (_ctx, categoryName: string, expectedQuantity: number) => {
            const category = featureContext.ticketCategories.find(
              (item) => item.name === categoryName
            );
            expect(category).toBeTruthy();
            expect(context.inventory).toBeTruthy();
            const item = context.inventory!.find((row) => row.id === category!.id);
            expect(item).toBeDefined();
            expect(item!.quantity).toBe(expectedQuantity);
          }
        );

        And(
          '另一票种 {string} 在该展览首场次的库存应为 {int}',
          (_ctx, categoryName: string, expectedQuantity: number) => {
            const category = featureContext.ticketCategories.find(
              (item) => item.name === categoryName
            );
            expect(category).toBeTruthy();
            expect(context.inventory).toBeTruthy();
            const item = context.inventory!.find((row) => row.id === category!.id);
            expect(item).toBeDefined();
            expect(item!.quantity).toBe(expectedQuantity);
          }
        );
      }
    );

    Scenario(
      'non-admin user cannot update inventory',
      (
        s: StepTest<{
          regularUserToken: string;
          inventoryUpdatePromise: Promise<unknown>;
        }>
      ) => {
        const { Given, When, Then, context } = s;

        Given('普通用户已登录', async () => {
          const { apiServer } = featureContext;
          const regularUserToken = await registerUser(apiServer);
          context.regularUserToken = regularUserToken;
        });

        When('普通用户尝试更新票种库存', async () => {
          const { apiServer } = featureContext;
          context.inventoryUpdatePromise = updateTicketCategoryMaxInventory(
            apiServer,
            context.regularUserToken,
            featureContext.exhibition.id,
            featureContext.ticketCategories[0].id,
            50
          );
        });

        Then('返回权限不足错误', async () => {
          await expect(context.inventoryUpdatePromise).rejects.toMatchObject({
            status: 403,
          });
        });
      }
    );
  }
);
