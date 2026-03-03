import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest
} from '@amiceli/vitest-cucumber';
import { expect, TestContext } from 'vitest';
import { Exhibition } from '@rc7/types';

const feature = await loadFeature('tests/features/exhibit.feature');

type Exhibition = Exhibition.Exhibition;
type TicketCategory = Exhibition.TicketCategory;
type ExhibitionWithCategories = Exhibition.ExhibitionWithCategories;

interface ScenarioContext {
  currentUser?: { id: string; role: string };
  exhibitions: Map<string, ExhibitionWithCategories>;
}

interface ExhibitionStepContext extends TestContext {
  draftExhibition?: Omit<Exhibition, 'id' | 'created_at' | 'updated_at'>;
  currentExhibitionId?: string;
  draftCategory?: Partial<Omit<TicketCategory, 'exhibit_id' | 'id' | 'created_at' | 'updated_at'>>;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  BeforeEachScenario,
  Background,
  Scenario,
  context: scenarioContext
}: FeatureDescriibeCallbackParams<ScenarioContext>) => {
  BeforeAllScenarios(() => {
    Object.assign(scenarioContext, { exhibitions: new Map<string, ExhibitionWithCategories>() });
  });

  BeforeEachScenario(() => {
    scenarioContext.exhibitions.clear();
    scenarioContext.currentUser = undefined;
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
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.description = description;
      });

      And('start date {string}', (ctx, startDate: string) => {
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.start_date = startDate;
      });

      And('end date {string}', (ctx, endDate: string) => {
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.end_date = endDate;
      });

      And('opening time {string}', (ctx, openingTime: string) => {
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.opening_time = openingTime;
      });

      And('closing time {string}', (ctx, closingTime: string) => {
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.closing_time = closingTime;
      });

      And('last entry time {string}', (ctx, lastEntryTime: string) => {
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.last_entry_time = lastEntryTime;
      });

      And('location {string}', (ctx, location: string) => {
        if (!context.draftExhibition) {
          throw new Error('缺少展览草稿数据');
        }
        context.draftExhibition.location = location;
      });

      When('create exhibition', () => {
        const { draftExhibition } = context;
        if (!draftExhibition) {
          throw new Error('创建展览前未设置草稿');
        }

        const exhibitionId = `exhibition_${Date.now()}`;
        const exhibition: ExhibitionWithCategories = {
          id: exhibitionId,
          ...draftExhibition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ticket_categories: []
        };

        scenarioContext.exhibitions.set(exhibitionId, exhibition);
        context.currentExhibitionId = exhibitionId;
      });

      Then('exhibition created successfully with empty ticket categories', () => {
        const { currentExhibitionId } = context;
        expect(currentExhibitionId).toBeTruthy();

        const createdExhibition = scenarioContext.exhibitions.get(currentExhibitionId!);
        expect(createdExhibition).toBeTruthy();
        expect(createdExhibition?.ticket_categories).toEqual([]);
        expect(createdExhibition?.name).toBe('cr7_life_museum');
      });
    }
  );

  Scenario(
    'add new ticket category to exhibition',
    ({ Given, When, Then, And, context }: StepTest<ExhibitionStepContext>) => {
      Given('created exhibition', () => {
        const exhibitionId = 'test_exhibition_1';
        const exhibition: ExhibitionWithCategories = {
          id: exhibitionId,
          name: 'test_exhibition',
          description: 'Test exhibition for tickets',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Test Location',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ticket_categories: []
        };

        scenarioContext.exhibitions.set(exhibitionId, exhibition);
        context.currentExhibitionId = exhibitionId;
      });

      When('add ticket category {string} to exhibition', (ctx, categoryName: string) => {
        Object.assign(context, {
          draftCategory: {
            id: `category_${Date.now()}`,
            name: categoryName
          }
        });
      });

      And('price {int}', (ctx, price: number) => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.price = price;
      });

      And('valid duration {int} day', (ctx, days: number) => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.valid_duration_days = days;
      });

      And('refound policy non refundable', () => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.refund_policy = 'NON_REFUNDABLE';
      });

      And('admittance {int} person', (ctx, count: number) => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.admittance = count;
      });

      Then('ticket category to exhibition {string} added successfully', (ctx, categoryName: string) => {
        const { currentExhibitionId, draftCategory } = context;
        expect(currentExhibitionId).toBeTruthy();
        expect(draftCategory).toBeTruthy();

        const exhibition = scenarioContext.exhibitions.get(currentExhibitionId!);
        expect(exhibition).toBeTruthy();

        // 模拟添加票种分类
        const ticketCategory: TicketCategory = {
          id: draftCategory!.id!,
          exhibit_id: currentExhibitionId!,
          name: draftCategory!.name!,
          price: draftCategory!.price!,
          valid_duration_days: draftCategory!.valid_duration_days!,
          refund_policy: draftCategory!.refund_policy!,
          admittance: draftCategory!.admittance!,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        exhibition!.ticket_categories.push(ticketCategory);

        // 验证
        const addedCategory = exhibition!.ticket_categories.find(
          (cat) => cat.name === categoryName
        );
        expect(addedCategory).toBeTruthy();
        expect(addedCategory?.name).toBe(categoryName);
        expect(addedCategory?.price).toBe(100);
        expect(addedCategory?.valid_duration_days).toBe(1);
        expect(addedCategory?.refund_policy).toBe('NON_REFUNDABLE');
        expect(addedCategory?.admittance).toBe(1);
      });
    }
  );

  Scenario(
    'add another ticket category to exhibition',
    ({ Given, When, Then, And, context }: StepTest<ExhibitionStepContext>) => {
      Given('created exhibition', () => {
        const exhibitionId = 'test_exhibition_2';
        const exhibition: ExhibitionWithCategories = {
          id: exhibitionId,
          name: 'test_exhibition_2',
          description: 'Test exhibition for multiple categories',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Test Location',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ticket_categories: []
        };

        scenarioContext.exhibitions.set(exhibitionId, exhibition);
        context.currentExhibitionId = exhibitionId;
      });

      When('add ticket category {string} to exhibition', (ctx, categoryName: string) => {
        Object.assign(context, {
          draftCategory: {
            id: `category_${Date.now()}`,
            name: categoryName
          }
        });
      });

      And('price {int}', (ctx, price: number) => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.price = price;
      });

      And('valid duration {int} day', (ctx, days: number) => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.valid_duration_days = days;
      });


      And('refound policy refundable until 48 hours before the event', () => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.refund_policy = 'REFUNDABLE_48H_BEFORE';
      });
      And('admittance {int} person', (ctx, count: number) => {
        if (!context.draftCategory) {
          throw new Error('缺少票种分类草稿数据');
        }
        context.draftCategory.admittance = count;
      });

      Then('ticket category to exhibition {string} added successfully', (ctx, categoryName: string) => {
        const { currentExhibitionId, draftCategory } = context;
        expect(currentExhibitionId).toBeTruthy();
        expect(draftCategory).toBeTruthy();

        const exhibition = scenarioContext.exhibitions.get(currentExhibitionId!);
        expect(exhibition).toBeTruthy();

        // 模拟添加票种分类
        const ticketCategory: TicketCategory = {
          id: draftCategory!.id!,
          exhibit_id: currentExhibitionId!,
          name: draftCategory!.name!,
          price: draftCategory!.price!,
          valid_duration_days: draftCategory!.valid_duration_days!,
          refund_policy: draftCategory!.refund_policy!,
          admittance: draftCategory!.admittance!,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        exhibition!.ticket_categories.push(ticketCategory);

        // 验证
        const addedCategory = exhibition!.ticket_categories.find(
          (cat) => cat.name === categoryName
        );
        expect(addedCategory).toBeTruthy();
        expect(addedCategory?.name).toBe(categoryName);
        expect(addedCategory?.price).toBe(150);
        expect(addedCategory?.valid_duration_days).toBe(10);
        expect(addedCategory?.refund_policy).toBe('REFUNDABLE_48H_BEFORE');
        expect(addedCategory?.admittance).toBe(2);
      });
    }
  );
});