import { Server } from "http";
import { getJSON, putJSON } from "../lib/api.js";
import { Inventory } from "@cr7/types";
import { expect } from "vitest";
import { assertTicketCategory } from "./exhibition.js";
import { TicketCategory } from "@cr7/types/exhibition.js";

export async function getSessionTickets(
  server: Server,
  token: string,
  eid: string,
  sid: string,
) {
  return getJSON<Inventory.SessionTicketsInventory[]>(
    server,
    `/exhibition/${eid}/sessions/${sid}/tickets`,
    { token }
  );
}

export async function updateTicketCategoryMaxInventory(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  quantity: number,
) {
  return putJSON(
    server,
    `/exhibition/${eid}/sessions/tickets/${tid}/inventory/max`,
    { body: { quantity }, token }
  );
}

export function assertSessionTickets(data: Inventory.SessionTicketsInventory) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('session_id', expect.any(String));
  expect(data).toHaveProperty('quantity', expect.any(Number));
  const { session_id: _s, quantity: _q, ...ticketCategoryData } = data;
  assertTicketCategory(ticketCategoryData as TicketCategory);
}
