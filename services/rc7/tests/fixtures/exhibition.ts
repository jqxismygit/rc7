import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { Exhibition } from "@rc7/types";
import { expect } from "vitest";

export async function createExhibition(
  server: Server,
  exhibition: Omit<Exhibition.Exhibition, 'id' | 'created_at' | 'updated_at'>,
  token?: string
) {
  return postJSON<Exhibition.ExhibitionWithCategories>(
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
  return getJSON<Exhibition.ExhibitionWithCategories>(
    server,
    `/exhibition/${eid}`,
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

export function assertExhibitionWithCategories(data: Exhibition.ExhibitionWithCategories) {
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
  expect(data).toHaveProperty('ticket_categories', expect.any(Array));
  (data.ticket_categories).forEach(assertTicketCategory);
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
