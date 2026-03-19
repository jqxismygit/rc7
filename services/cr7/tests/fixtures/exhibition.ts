import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { Exhibition } from "@cr7/types";
import { expect } from "vitest";
import { StepTest } from "@amiceli/vitest-cucumber";
import { random_text } from "../lib/random.js";
import { APIServerFixture } from "./services.js";

export async function createExhibition(
  server: Server,
  exhibition: Omit<Exhibition.Exhibition, 'id' | 'created_at' | 'updated_at'>,
  token?: string
) {
  return postJSON<Exhibition.Exhibition>(
    server,
    '/exhibition',
    { body: exhibition, token }
  );
}

export async function getExhibition(
  server: Server,
  eid: string,
  token?: string
) {
  return getJSON<Exhibition.Exhibition>(
    server,
    `/exhibition/${eid}`,
    { token }
  );
}

export async function listExhibitions(
  server: Server,
  options?: { limit?: number; offset?: number },
  token?: string
) {
  return getJSON<{
    data: Exhibition.Exhibition[]
    total: number
    limit: number
    offset: number
  }>(
    server,
    '/exhibition',
    {
      token,
      query: options,
    }
  );
}

export interface ExhibitionListResponse {
  data: Exhibition.Exhibition[];
  total: number;
  limit: number;
  offset: number;
}

export async function getTicketCategories(
  server: Server,
  eid: string,
  token?: string
) {
  return getJSON<Exhibition.TicketCategory[]>(
    server,
    `/exhibition/${eid}/tickets`,
    { token }
  );
}

export async function getSessions(
  server: Server,
  eid: string,
  token?: string
) {
  return getJSON<Exhibition.Session[]>(
    server,
    `/exhibition/${eid}/sessions`,
    { token }
  );
}

export async function addTicketCategory(
  server: Server,
  eid: string,
  category: Omit<Exhibition.TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>,
  token?: string
) {
  return postJSON<Exhibition.TicketCategory>(
    server,
    `/exhibition/${eid}/tickets`,
    { body: category, token }
  );
}

export function assertExhibition(data: Exhibition.Exhibition) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('name', expect.any(String));
  expect(data).toHaveProperty('description', expect.any(String));
  expect(data).toHaveProperty('start_date', expect.any(String));
  expect(data).toHaveProperty('end_date', expect.any(String));
  expect(data).toHaveProperty('opening_time', expect.any(String));
  expect(data).toHaveProperty('closing_time', expect.any(String));
  expect(data).toHaveProperty('last_entry_time', expect.any(String));
  expect(data).toHaveProperty('location', expect.any(String));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}

export function assertTicketCategory(data: Exhibition.TicketCategory) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('name', expect.any(String));
  expect(data).toHaveProperty('price', expect.any(Number));
  expect(data).toHaveProperty('valid_duration_days', expect.any(Number));
  expect(data).toHaveProperty('refund_policy', expect.any(String));
  expect(data).toHaveProperty('admittance', expect.any(Number));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}

export function prepareExhibitionData(
  Step: StepTest['Given'],
  scenarioContext: { fixtures: APIServerFixture },
  context: { exhibition: Exhibition.Exhibition },
) {
  Step('created exhibition', async () => {
    const { apiServer } = scenarioContext.fixtures.values;

    const exhibition = await createExhibition(apiServer, {
      name: `test_exhibition_${random_text(5)}`,
      description: 'Test exhibition',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Test Location'
    });
    Object.assign(context, { exhibition });
  });
}

export function prepareExhibitionListData(
  Step: StepTest['Given'] | StepTest['And'],
  scenarioContext: { fixtures: APIServerFixture },
  context: { createdExhibitions?: Exhibition.Exhibition[] },
) {
  Step('created {int} exhibitions for listing', async (ctx, count: number) => {
    const { apiServer } = scenarioContext.fixtures.values;
    const createdExhibitions: Exhibition.Exhibition[] = [];

    for (let i = 0; i < count; i++) {
      const exhibition = await createExhibition(apiServer, {
        name: `list_exhibition_${i + 1}_${random_text(5)}`,
        description: `List test exhibition ${i + 1}`,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        opening_time: '10:00',
        closing_time: '18:00',
        last_entry_time: '17:00',
        location: 'Test Location'
      });
      createdExhibitions.push(exhibition);
    }

    Object.assign(context, { createdExhibitions });
  });
}

export interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
}

export function prepareInventoryExhibitionData(
  Step: StepTest['Given'] | StepTest['And'],
  scenarioContext: { fixtures: APIServerFixture },
  context: ExhibitionContext,
) {
  Step('created exhibition with 2 sessions', async () => {
    const { apiServer } = scenarioContext.fixtures.values;

    const exhibition = await createExhibition(apiServer, {
      name: `inventory_test_${random_text(5)}`,
      description: 'Inventory test exhibition',
      start_date: '2026-01-01',
      end_date: '2026-01-02',
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Shanghai'
    });

    const sessions = await getSessions(apiServer, exhibition.id);

    Object.assign(context, {
      exhibition,
      sessions,
    });
  });
}

export function prepareInventoryTicketData(
  Step: StepTest['Given'] | StepTest['And'],
  scenarioContext: { fixtures: APIServerFixture },
  context: ExhibitionContext & { ticketCategories: Exhibition.TicketCategory[]; },
) {
  Step('created 2 ticket categories for the exhibition', async () => {
    const { apiServer } = scenarioContext.fixtures.values;
    expect(context.exhibition).toBeTruthy();

    const earlyBird = await addTicketCategory(apiServer, context.exhibition!.id, {
      name: 'early_bird',
      price: 100,
      valid_duration_days: 1,
      refund_policy: 'NON_REFUNDABLE',
      admittance: 1,
    });

    const regular = await addTicketCategory(apiServer, context.exhibition!.id, {
      name: 'regular',
      price: 150,
      valid_duration_days: 1,
      refund_policy: 'REFUNDABLE_48H_BEFORE',
      admittance: 1,
    });

    Object.assign(context, {
      ticketCategories: [earlyBird, regular],
    });
  });
}

// Session related functions
export function assertSession(data: Exhibition.Session) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('session_date', expect.any(String));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}
