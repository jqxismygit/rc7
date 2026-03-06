import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { Inventory } from "@rc7/types";
import { expect } from "vitest";

export async function getSessionInventory(
  server: Server,
  eid: string,
  sid: string,
  token?: string
) {
  return getJSON<Inventory.SessionInventory[]>(
    server,
    `/exhibition/${eid}/sessions/${sid}/inventory`,
    { token }
  );
}

export async function updateTicketCategoryMaxInventory(
  server: Server,
  eid: string,
  tid: string,
  quantity: number,
  token?: string
) {
  return postJSON<{ success: boolean }>(
    server,
    `/exhibition/${eid}/inventory/max/ticket/${tid}`,
    { body: { quantity }, token }
  );
}

export function assertSessionInventory(data: Inventory.SessionInventory) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('session_id', expect.any(String));
  expect(data).toHaveProperty('ticket_category_id', expect.any(String));
  expect(data).toHaveProperty('quantity', expect.any(Number));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}
