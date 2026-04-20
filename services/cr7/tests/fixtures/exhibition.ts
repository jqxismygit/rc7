import { Server } from 'http';
import { getJSON, postJSON, patchJSON } from '../lib/api.js';
import { Exhibition } from '@cr7/types';
import { expect } from 'vitest';
import { random_text } from '../lib/random.js';
import { updateTicketCategoryMaxInventory } from './inventory.js';
import { toDateLabel } from '../lib/relative-date.js';

export type DraftExhibition = Omit<
  Exhibition.Exhibition,
  'id' | 'status' | 'created_at' | 'updated_at'
>;

export type DraftTicketCategory = Omit<
  Exhibition.TicketCategory,
  'id' | 'exhibit_id' | 'created_at' | 'updated_at'
> & {
  price: number;
};

export type PreparedTicketCategory = Exhibition.TicketCategory & {
  price: number;
};

export type DraftTicketCategoryPatch = Exhibition.TicketCategoryPatch;

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
  options?: { limit?: number; offset?: number; all?: boolean },
) {
  return getJSON<{
    data: Exhibition.Exhibition[];
    total: number;
    limit: number;
    offset: number;
  }>(
    server,
    '/exhibition',
    {
      token,
      query: options,
    }
  );
}

export async function listAdminExhibitions(
  server: Server,
  token: string,
  options?: { limit?: number; offset?: number },
) {
  return getJSON<{
    data: Exhibition.Exhibition[];
    total: number;
    limit: number;
    offset: number;
  }>(
    server,
    '/exhibition',
    {
      token,
      query: { ...options, all: true },
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
  token?: string,
  range?: {
    session_mode?: 'DAY' | 'HALF_DAY';
    start_session_date?: string;
    end_session_date?: string;
  },
) {
  const query = {
    session_mode: 'DAY' as const,
    ...range,
  };

  return getJSON<Exhibition.Session[]>(
    server,
    `/exhibition/${eid}/sessions`,
    { token, query }
  )
    .then(res => res.map(r => Object.assign(r, { session_date: new Date(r.session_date) })));
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

export async function updateTicketCategory(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  patch: DraftTicketCategoryPatch,
) {
  return patchJSON<Exhibition.TicketCategory>(
    server,
    `/exhibition/${eid}/tickets/${tid}`,
    { body: patch, token }
  );
}

export async function updateExhibition(
  server: Server,
  token: string,
  eid: string,
  patch: Exhibition.ExhibitionPatch,
) {
  return patchJSON<Exhibition.Exhibition>(
    server,
    `/exhibition/${eid}`,
    { body: patch, token }
  );
}

export async function updateExhibitionStatus(
  server: Server,
  token: string,
  eid: string,
  status: Exhibition.ExhibitionStatus,
): Promise<void> {
  await patchJSON<null>(
    server,
    `/exhibition/${eid}/status`,
    { body: { status }, token }
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
  expect(data).toHaveProperty('city', expect.any(String));
  expect(data).toHaveProperty('venue_name', expect.any(String));
  expect(data).toHaveProperty('location', expect.any(String));
  expect(data).toHaveProperty('cover_url', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('status', expect.stringMatching(/^(ENABLE|DISABLE)$/));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}

export function assertTicketCategory(data: Exhibition.TicketCategory) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('name', expect.any(String));
  expect(data).toHaveProperty('description', expect.any(String));
  expect(data).toHaveProperty('valid_duration_days', expect.any(Number));
  expect(data).toHaveProperty('refund_policy', expect.any(String));
  expect(data).toHaveProperty('admittance', expect.any(Number));
  expect(data).toHaveProperty('list_price', expect.any(Number));
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
          start_date: toDateLabel('1天后'),
          end_date: toDateLabel('365天后'),
          opening_time: '10:00',
          closing_time: '18:00',
          last_entry_time: '17:00',
          city: '上海',
          venue_name: '上海展览中心',
          location: 'Test Location',
          cover_url: null,
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

export async function prepareExhibition(
  apiServer: Server,
  token: string,
  overrides?: Partial<DraftExhibition>
): Promise<Exhibition.Exhibition> {
  const exhibition_fixture = Object.assign(
    {
      name: `inventory_test_${random_text(5)}`,
      description: 'Inventory test exhibition',
      start_date: toDateLabel('1天后'),
      end_date: toDateLabel('2天后'),
      opening_time: '10:00',
      closing_time: '18:00',
      last_entry_time: '17:00',
      city: '上海',
      venue_name: '上海展览中心',
      location: 'Shanghai',
      cover_url: null,
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
      description: 'ticket category description',
      price: 100,
      list_price: 120,
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
  expect(data).toHaveProperty('session_date', expect.any(Date));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}
