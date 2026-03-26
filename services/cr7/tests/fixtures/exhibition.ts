import { Server } from "http";
import { getJSON, postJSON } from "../lib/api.js";
import { Exhibition } from "@cr7/types";
import { expect } from "vitest";
import { random_text } from "../lib/random.js";
import { updateTicketCategoryMaxInventory } from "./inventory.js";

export type DraftExhibition = Omit<
  Exhibition.Exhibition,
  'id' | 'created_at' | 'updated_at'
>;

export type DraftTicketCategory = Omit<
  Exhibition.TicketCategory,
  'id' | 'exhibit_id' | 'created_at' | 'updated_at'
>;

export interface ExhibitionWithSessions {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
}

export interface ExhibitionSessionTicket {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticket: Exhibition.TicketCategory;
}

export interface ExhibitionWithNamedTickets {
  exhibition: Exhibition.Exhibition;
  session: Exhibition.Session;
  ticketByName: Record<string, Exhibition.TicketCategory>;
}

export async function createExhibition(
  server: Server,
  token: string,
  exhibition: DraftExhibition,
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
  token?: string,
) {
  return getJSON<Exhibition.Exhibition>(
    server,
    `/exhibition/${eid}`,
    { token }
  );
}

export async function listExhibitions(
  server: Server,
  token: string,
  options?: { limit?: number; offset?: number },
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
  token: string,
  eid: string,
  category: DraftTicketCategory
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

export interface ExhibitionContext {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
}

export async function createExhibitions(
  apiServer: Server,
  token: string,
  count: number,
  options: {
    namePrefix?: string;
    exhibitionOverrides?: Partial<DraftExhibition>;
  } = {},
): Promise<Exhibition.Exhibition[]> {
  const { namePrefix = 'test_exhibition', exhibitionOverrides } = options;
  const exhibitions: Exhibition.Exhibition[] = [];

  for (let index = 0; index < count; index += 1) {
    const exhibition = await createExhibition(
      apiServer,
      token,
      Object.assign(
        {
          name: `${namePrefix}_${index + 1}_${random_text(5)}`,
          description: `Test exhibition ${index + 1}`,
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          location: 'Test Location',
        },
        exhibitionOverrides,
      ),
    );
    exhibitions.push(exhibition);
  }

  return exhibitions;
}

export async function prepareExhibitionWithSessions(
  apiServer: Server,
  token: string,
  overrides?: Partial<DraftExhibition>,
): Promise<ExhibitionWithSessions> {
  const exhibition = await prepareExhibition(apiServer, token, overrides);
  const sessions = await getSessions(apiServer, exhibition.id, token);

  return {
    exhibition,
    sessions,
  };
}

export async function prepareExhibitionSessionTicket(
  apiServer: Server,
  token: string,
  options: {
    exhibitionOverrides?: Partial<DraftExhibition>;
    ticketOverrides?: Partial<DraftTicketCategory>;
    maxInventory?: number;
  } = {},
): Promise<ExhibitionSessionTicket> {
  const {
    exhibitionOverrides,
    ticketOverrides,
    maxInventory,
  } = options;
  const exhibition = await prepareExhibition(apiServer, token, exhibitionOverrides);
  const [session] = await getSessions(apiServer, exhibition.id, token);
  const ticket = await prepareTicketCategory(
    apiServer,
    token,
    exhibition.id,
    ticketOverrides,
  );

  if (typeof maxInventory === 'number') {
    await updateTicketCategoryMaxInventory(
      apiServer,
      token,
      exhibition.id,
      ticket.id,
      maxInventory,
    );
  }

  return {
    exhibition,
    session,
    ticket,
  };
}

export async function prepareExhibitionWithNamedTickets(
  apiServer: Server,
  token: string,
  ticketNames: string[],
  options: {
    exhibitionOverrides?: Partial<DraftExhibition>;
    createTicket?: (ticketName: string, index: number) => Partial<DraftTicketCategory>;
  } = {},
): Promise<ExhibitionWithNamedTickets> {
  const exhibition = await prepareExhibition(apiServer, token, options.exhibitionOverrides);
  const [session] = await getSessions(apiServer, exhibition.id, token);
  const ticketByName: Record<string, Exhibition.TicketCategory> = {};

  for (let index = 0; index < ticketNames.length; index += 1) {
    const ticketName = ticketNames[index];
    const ticket = await prepareTicketCategory(
      apiServer,
      token,
      exhibition.id,
      {
        name: ticketName,
        price: 100 + index * 50,
        valid_duration_days: 1,
        refund_policy: 'NON_REFUNDABLE',
        admittance: 1,
        ...options.createTicket?.(ticketName, index),
      },
    );
    ticketByName[ticketName] = ticket;
  }

  return {
    exhibition,
    session,
    ticketByName,
  };
}

export async function prepareExhibition(
  apiServer: Server,
  token: string,
  overrides?: Partial<DraftExhibition>
): Promise<Exhibition.Exhibition> {
  const exhibition_fixture = Object.assign(
    {
      name: `inventory_test_${random_text(5)}`,
      description: 'Inventory test exhibition',
      start_date: '2026-01-01',
      end_date: '2026-01-02',
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      location: 'Shanghai',
    },
    overrides
  );
  return createExhibition(apiServer, token, exhibition_fixture);
}

export async function prepareTicketCategory(
  apiServer: Server,
  token: string,
  eid: string,
  overrides?: Partial<DraftTicketCategory>
): Promise<Exhibition.TicketCategory> {
  const categoryFixture = Object.assign(
    {
      name: `ticket_category_${random_text(5)}`,
      price: 100,
      valid_duration_days: 1,
      refund_policy: 'NON_REFUNDABLE',
      admittance: 1,
    },
    overrides
  );
  return addTicketCategory(apiServer, token, eid, categoryFixture);
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
