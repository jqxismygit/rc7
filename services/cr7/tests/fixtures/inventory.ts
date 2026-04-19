import { Server } from 'http';
import { getJSON, putJSON } from '../lib/api.js';
import { Inventory } from '@cr7/types';
import { expect } from 'vitest';
import { assertTicketCategory } from './exhibition.js';
import { TicketCategory } from '@cr7/types/exhibition.js';

export async function getSessionTickets(
  server: Server,
  token: string,
  eid: string,
  sid: string,
) {
  return getJSON<Inventory.SessionTicketPrice[]>(
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
  range?: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  return putJSON(
    server,
    `/exhibition/${eid}/sessions/tickets/${tid}/inventory/max`,
    {
      body: {
        quantity,
        ...(range ?? {}),
      },
      token,
    }
  );
}

export async function getTicketCalendarInventory(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  range: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  return getJSON<Inventory.TicketCalendarInventory[]>(
    server,
    `/exhibition/${eid}/tickets/${tid}/calendar`,
    { token, query: range },
  );
}

export async function updateTicketCalendarPrice(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  price: number,
  range: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  return putJSON(
    server,
    `/exhibition/${eid}/tickets/${tid}/calendar/price`,
    {
      body: {
        price,
        ...range,
      },
      token,
    }
  );
}

export function assertSessionTickets(data: Inventory.SessionTicketPrice) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('session_id', expect.any(String));
  expect(data).toHaveProperty('quantity', expect.any(Number));
  expect(data).toHaveProperty('price', expect.any(Number));
  const { session_id: _s, quantity: _q, price: _p, ...ticketCategoryData } = data;
  assertTicketCategory(ticketCategoryData as TicketCategory);
}
