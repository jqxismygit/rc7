import { Pool, PoolClient } from "pg";
import type { Exhibition, Inventory } from "@cr7/types";

type DBClient = Pool | PoolClient;

export type EXHIBITION_DATA_ERROR_CODES =
  | 'EXHIBITION_NOT_FOUND'
  | 'TICKET_CATEGORY_NOT_FOUND'
  | 'SESSION_NOT_FOUND';

export class ExhibitionDataError extends Error {
  code: EXHIBITION_DATA_ERROR_CODES;

  constructor(message: string, code: EXHIBITION_DATA_ERROR_CODES) {
    super(message);
    this.name = 'ExhibitionDataError';
    this.code = code;
  }
}

export type TicketCategoryRefundPolicyRow = {
  refund_policy: 'NON_REFUNDABLE' | 'REFUNDABLE_48H_BEFORE';
};
export async function createExhibition(
  client: Pool,
  schema: string,
  exhibition: Omit<Exhibition.Exhibition, 'id' | 'created_at' | 'updated_at'>
): Promise<Exhibition.Exhibition> {
  const { rows: [result] } = await client.query(
    `INSERT INTO ${schema}.exhibitions (
      name, description, start_date, end_date,
      opening_time, closing_time, last_entry_time, location, cover_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id, name, description,
      start_date,
      end_date,
      opening_time,
      closing_time,
      last_entry_time,
      location,
      cover_url,
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
      exhibition.location,
      exhibition.cover_url ?? null
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
      cover_url,
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

export async function getExhibitions(
  client: Pool,
  schema: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ exhibitions: Exhibition.Exhibition[]; total: number }> {
  const { rows: countRows } = await client.query(
    `SELECT COUNT(*) as total
    FROM ${schema}.exhibitions`
  );

  const total = parseInt(countRows[0].total, 10);

  const { rows: exhibitions } = await client.query(
    `SELECT
      id, name, description,
      start_date,
      end_date,
      opening_time,
      closing_time,
      last_entry_time,
      location,
      cover_url,
      created_at,
      updated_at
    FROM ${schema}.exhibitions
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { exhibitions, total };
}

export async function getTicketCategoriesByExhibitionId(
  client: DBClient,
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
      ota_xc_option_id,
      created_at,
      updated_at
    FROM ${schema}.exhibit_ticket_categories
    WHERE eid = $1
    ORDER BY created_at`,
    [eid]
  );

  return rows;
}

export async function getTicketCategoryById(
  client: DBClient,
  schema: string,
  eid: string,
  tid: string,
): Promise<Exhibition.TicketCategory> {
  const { rows } = await client.query<Exhibition.TicketCategory>(
    `SELECT
      id,
      eid AS exhibit_id,
      name,
      price,
      valid_duration_days,
      refund_policy,
      admittance,
      ota_xc_option_id,
      created_at,
      updated_at
    FROM ${schema}.exhibit_ticket_categories
    WHERE id = $1
      AND eid = $2`,
    [tid, eid],
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Ticket category not found', 'TICKET_CATEGORY_NOT_FOUND');
  }

  return rows[0];
}

export async function updateTicketCategoryOtaXcOptionId(
  client: DBClient,
  schema: string,
  eid: string,
  tid: string,
  otaOptionId: string,
): Promise<Exhibition.TicketCategory> {
  const { rows } = await client.query<Exhibition.TicketCategory>(
    `UPDATE ${schema}.exhibit_ticket_categories
    SET
      ota_xc_option_id = $3,
      updated_at = NOW()
    WHERE id = $1
      AND eid = $2
    RETURNING
      id,
      eid AS exhibit_id,
      name,
      price,
      valid_duration_days,
      refund_policy,
      admittance,
      ota_xc_option_id,
      created_at,
      updated_at`,
    [tid, eid, otaOptionId],
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Ticket category not found', 'TICKET_CATEGORY_NOT_FOUND');
  }

  return rows[0];
}

export async function listSessionInventoryByTicketAndDateRange(
  client: DBClient,
  schema: string,
  eid: string,
  tid: string,
  startDate: Date,
  endDate: Date,
): Promise<Array<{ date: string; quantity: number }>> {
  const { rows } = await client.query<{ date: string; quantity: number }>(
    `SELECT
      s.session_date::text AS date,
      COALESCE((i.quantity - i.reserved_quantity), 0)::integer AS quantity
    FROM ${schema}.exhibit_sessions s
    LEFT JOIN ${schema}.exhibit_session_inventories i
      ON i.session_id = s.id
      AND i.ticket_category_id = $2
    WHERE s.session_id = $1
      AND s.session_date BETWEEN $3::date AND $4::date
    ORDER BY s.session_date`,
    [eid, tid, startDate, endDate],
  );

  return rows;
}

export async function getSessionsByExhibitionId(
  client: DBClient,
  schema: string,
  eid: string,
  startDate?: Date,
  endDate?: Date,
): Promise<Exhibition.Session[]> {
  const values: unknown[] = [eid];
  const filters = ['session_id = $1'];

  if (startDate !== undefined) {
    values.push(startDate);
    filters.push(`session_date >= $${values.length}::date`);
  }

  if (endDate !== undefined) {
    values.push(endDate);
    filters.push(`session_date <= $${values.length}::date`);
  }

  const { rows } = await client.query(
    `SELECT
      id,
      session_id as exhibit_id,
      session_date,
      created_at,
      updated_at
    FROM ${schema}.exhibit_sessions
    WHERE ${filters.join(' AND ')}
    ORDER BY session_date`,
    values,
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
      ota_xc_option_id,
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
      c.ota_xc_option_id,
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

export async function getTicketCategoryByIdGlobal(
  client: DBClient,
  schema: string,
  tid: string,
): Promise<Exhibition.TicketCategory> {
  const { rows } = await client.query<Exhibition.TicketCategory>(
    `SELECT
      id,
      eid AS exhibit_id,
      name,
      price,
      valid_duration_days,
      refund_policy,
      admittance,
      ota_xc_option_id,
      created_at,
      updated_at
    FROM ${schema}.exhibit_ticket_categories
    WHERE id = $1`,
    [tid],
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Ticket category not found', 'TICKET_CATEGORY_NOT_FOUND');
  }

  return rows[0];
}

export async function getTicketCategoryRefundPoliciesByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<TicketCategoryRefundPolicyRow[]> {
  const { rows } = await client.query<TicketCategoryRefundPolicyRow>(
    `SELECT tc.refund_policy
    FROM ${schema}.exhibit_order_items oi
    JOIN ${schema}.exhibit_ticket_categories tc ON tc.id = oi.ticket_category_id
    WHERE oi.order_id = $1`,
    [orderId],
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
      (i.quantity - i.reserved_quantity) AS quantity,
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

export async function updateExhibition(
  client: Pool,
  schema: string,
  eid: string,
  patch: Exhibition.ExhibitionPatch,
): Promise<Exhibition.Exhibition> {
  const fields: string[] = [];
  const values: unknown[] = [eid];
  let idx = 2;

  if ('name' in patch) {
    fields.push(`name = $${idx++}`);
    values.push(patch.name);
  }
  if ('description' in patch) {
    fields.push(`description = $${idx++}`);
    values.push(patch.description);
  }
  if ('opening_time' in patch) {
    fields.push(`opening_time = $${idx++}`);
    values.push(patch.opening_time);
  }
  if ('closing_time' in patch) {
    fields.push(`closing_time = $${idx++}`);
    values.push(patch.closing_time);
  }
  if ('last_entry_time' in patch) {
    fields.push(`last_entry_time = $${idx++}`);
    values.push(patch.last_entry_time);
  }
  if ('location' in patch) {
    fields.push(`location = $${idx++}`);
    values.push(patch.location);
  }
  if ('cover_url' in patch) {
    fields.push(`cover_url = $${idx++}`);
    values.push(patch.cover_url ?? null);
  }

  if (fields.length === 0) {
    return getExhibitionById(client, schema, eid);
  }

  fields.push(`updated_at = NOW()`);

  const { rows } = await client.query<Exhibition.Exhibition>(
    `UPDATE ${schema}.exhibitions
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING
      id, name, description,
      start_date,
      end_date,
      opening_time,
      closing_time,
      last_entry_time,
      location,
      cover_url,
      created_at,
      updated_at`,
    values,
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Exhibition not found', 'EXHIBITION_NOT_FOUND');
  }

  return rows[0];
}

export async function getSessionById(
  client: DBClient,
  schema: string,
  sessionId: string,
): Promise<Exhibition.Session> {
  const { rows } = await client.query<Exhibition.Session>(
    `SELECT
      id,
      session_id AS exhibit_id,
      session_date,
      created_at,
      updated_at
    FROM ${schema}.exhibit_sessions
    WHERE id = $1`,
    [sessionId],
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Session not found', 'SESSION_NOT_FOUND');
  }

  return rows[0];
}
