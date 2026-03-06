import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { Exhibition } from "@rc7/types";
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

// Session related functions
export function assertSession(data: Exhibition.Session) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('session_date', expect.any(String));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}
