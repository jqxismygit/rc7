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
): Promise<Exhibition.ExhibitionWithCategories> {
  const { rows: [result] } = await client.query(
    `INSERT INTO ${schema}.exhibitions (
      name, description, start_date, end_date,
      opening_time, closing_time, last_entry_time, location
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id, name, description,
      start_date::TEXT as start_date,
      end_date::TEXT as end_date,
      opening_time::TEXT as opening_time,
      closing_time::TEXT as closing_time,
      last_entry_time::TEXT as last_entry_time,
      location,
      created_at::TEXT as created_at,
      updated_at::TEXT as updated_at`,
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

  return {
    ...result,
    ticket_categories: []
  };
}

export async function getExhibitionById(
  client: Pool,
  schema: string,
  eid: string
): Promise<Exhibition.ExhibitionWithCategories> {
  const { rows } = await client.query(
    `SELECT
      e.id, e.name, e.description,
      e.start_date::TEXT as start_date,
      e.end_date::TEXT as end_date,
      e.opening_time::TEXT as opening_time,
      e.closing_time::TEXT as closing_time,
      e.last_entry_time::TEXT as last_entry_time,
      e.location,
      e.created_at::TEXT as created_at,
      e.updated_at::TEXT as updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', tc.id,
            'exhibit_id', tc.eid,
            'name', tc.name,
            'price', tc.price,
            'valid_duration_days', tc.valid_duration_days,
            'refund_policy', tc.refund_policy,
            'admittance', tc.admittance,
            'created_at', tc.created_at::TEXT,
            'updated_at', tc.updated_at::TEXT
          )
          ORDER BY tc.created_at
        ) FILTER (WHERE tc.id IS NOT NULL),
        '[]'
      ) as ticket_categories
    FROM ${schema}.exhibitions e
    LEFT JOIN ${schema}.exhibit_ticket_categories tc ON e.id = tc.eid
    WHERE e.id = $1
    GROUP BY e.id`,
    [eid]
  );

  if (rows.length === 0) {
    throw new ExhibitionDataError('Exhibition not found', 'EXHIBITION_NOT_FOUND');
  }

  return rows[0];
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
      refund_policy as refund_policy,
      admittance,
      created_at::TEXT as created_at,
      updated_at::TEXT as updated_at`,
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
