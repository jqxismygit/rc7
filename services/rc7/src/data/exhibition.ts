import { Pool } from "pg";
import type { Exhibition, Inventory } from "@rc7/types";

export type EXHIBITION_DATA_ERROR_CODES =
  | 'EXHIBITION_NOT_FOUND'
  | 'TICKET_CATEGORY_NOT_FOUND';

export class ExhibitionDataError extends Error {
  code: EXHIBITION_DATA_ERROR_CODES;

  constructor(message: string, code: EXHIBITION_DATA_ERROR_CODES) {
    super(message);
    this.name = 'ExhibitionDataError';
    this.code = code;
  }
}

export async function createExhibition(
  client: Pool,
  schema: string,
  exhibition: Omit<Exhibition.Exhibition, 'id' | 'created_at' | 'updated_at'>
): Promise<Exhibition.Exhibition> {
  const { rows: [result] } = await client.query(
    `INSERT INTO ${schema}.exhibitions (
      name, description, start_date, end_date,
      opening_time, closing_time, last_entry_time, location
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id, name, description,
      start_date,
      end_date,
      opening_time,
      closing_time,
      last_entry_time,
      location,
      created_at,
      updated_at`,
    [
      exhibition.name,
      exhibition.description,
      exhibition.start_date,
      exhibition.end_date,
      exhibition.opening_time,
      exhibition.closing_time,
      exhibition.last_entry_time,
      exhibition.location
    ]
  );

  await client.query(
    `INSERT INTO ${schema}.exhibit_sessions (
      session_id,
      session_date
    )
    SELECT
      $1,
      gs::date
    FROM GENERATE_SERIES($2::date, $3::date, INTERVAL '1 day') gs`,
    [result.id, exhibition.start_date, exhibition.end_date]
  );

  return result;
}

export async function getExhibitionById(
  client: Pool,
  schema: string,
  eid: string
): Promise<Exhibition.Exhibition> {
  const { rows } = await client.query(
    `SELECT
      id, name, description,
      start_date,
      end_date,
      opening_time,
      closing_time,
      last_entry_time,
      location,
      created_at,
      updated_at
    FROM ${schema}.exhibitions
    WHERE id = $1`,
    [eid]
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Exhibition not found', 'EXHIBITION_NOT_FOUND');
  }

  return rows[0];
}

export async function getTicketCategoriesByExhibitionId(
  client: Pool,
  schema: string,
  eid: string
): Promise<Exhibition.TicketCategory[]> {
  const { rows } = await client.query(
    `SELECT
      id,
      eid as exhibit_id,
      name,
      price,
      valid_duration_days,
      refund_policy,
      admittance,
      created_at,
      updated_at
    FROM ${schema}.exhibit_ticket_categories
    WHERE eid = $1
    ORDER BY created_at`,
    [eid]
  );

  return rows;
}

export async function getSessionsByExhibitionId(
  client: Pool,
  schema: string,
  eid: string
): Promise<Exhibition.Session[]> {
  const { rows } = await client.query(
    `SELECT
      id,
      session_id as exhibit_id,
      session_date,
      created_at,
      updated_at
    FROM ${schema}.exhibit_sessions
    WHERE session_id = $1
    ORDER BY session_date`,
    [eid]
  );

  return rows;
}

export async function createTicketCategory(
  client: Pool,
  schema: string,
  eid: string,
  category: Omit<Exhibition.TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
): Promise<Exhibition.TicketCategory> {
  const { rows: [result] } = await client.query(
    `INSERT INTO ${schema}.exhibit_ticket_categories (
      eid, name, price, valid_duration_days, refund_policy, admittance
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      eid as exhibit_id,
      name,
      price,
      valid_duration_days,
      refund_policy,
      admittance,
      created_at,
      updated_at`,
    [
      eid,
      category.name,
      category.price,
      category.valid_duration_days,
      category.refund_policy,
      category.admittance
    ]
  );

  return result;
}

export async function getSessionTicketCategoriesBySessionId(
  client: Pool,
  schema: string,
  eid: string,
  sid: string
): Promise<Exhibition.TicketCategory[]> {
  const { rows } = await client.query(
    `SELECT
      c.id,
      c.eid as exhibit_id,
      c.name,
      c.price,
      c.valid_duration_days,
      c.refund_policy,
      c.admittance,
      c.created_at,
      c.updated_at
    FROM ${schema}.exhibit_sessions s
    JOIN ${schema}.exhibit_ticket_categories c
      ON c.eid = s.session_id
    WHERE s.session_id = $1
      AND s.id = $2
    ORDER BY c.created_at`,
    [eid, sid]
  );

  return rows;
}

export async function getSessionInventoryBySessionId(
  client: Pool,
  schema: string,
  eid: string,
  sid: string
): Promise<Inventory.SessionInventory[]> {
  const { rows } = await client.query(
    `SELECT
      i.id,
      i.session_id,
      i.ticket_category_id,
      i.quantity,
      i.created_at,
      i.updated_at
    FROM ${schema}.exhibit_session_inventories i
    JOIN ${schema}.exhibit_sessions s
      ON s.id = i.session_id
    WHERE s.session_id = $1
      AND s.id = $2`,
    [eid, sid]
  );

  return rows;
}

export async function updateTicketCategoryInventoryMax(
  client: Pool,
  schema: string,
  eid: string,
  tid: string,
  quantity: number
) {
  const { rows: ticketCategoryRows } = await client.query(
    `SELECT id
    FROM ${schema}.exhibit_ticket_categories
    WHERE id = $1
      AND eid = $2`,
    [tid, eid]
  );

  if (ticketCategoryRows.length === 0) {
    throw new ExhibitionDataError('Ticket category not found', 'TICKET_CATEGORY_NOT_FOUND');
  }

  await client.query(
    `INSERT INTO ${schema}.exhibit_session_inventories (
      session_id,
      ticket_category_id,
      quantity
    )
    SELECT
      s.id,
      $2,
      $3
    FROM ${schema}.exhibit_sessions s
    WHERE s.session_id = $1
    ON CONFLICT (session_id, ticket_category_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      updated_at = NOW()`,
    [eid, tid, quantity]
  );
}
