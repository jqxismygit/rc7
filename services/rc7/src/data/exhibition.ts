import { Pool } from "pg";
import type { Exhibition } from "@rc7/types";

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
