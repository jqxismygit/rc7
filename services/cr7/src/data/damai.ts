import { Pool, PoolClient } from 'pg';
import type { Damai } from '@cr7/types';

type DBClient = Pool | PoolClient;

export async function createDamaiOrderSyncRecord(
  client: DBClient,
  schema: string,
  params: {
    id?: string;
    damaiOrderId?: string | null;
    requestPath: string;
    requestBody: unknown;
    responseBody?: unknown | null;
    syncStatus: Damai.DamaiOrderSyncStatus;
    orderId?: string | null;
  }
): Promise<Damai.DamaiOrderSyncRecord> {
  const { rows } = await client.query<Damai.DamaiOrderSyncRecord>(
    `INSERT INTO ${schema}.damai_order_sync_records (
      id,
      damai_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id
    )
    VALUES (COALESCE($1::uuid, GEN_RANDOM_UUID()), $2, $3, $4::jsonb, $5::jsonb, $6, $7)
    RETURNING
      id,
      damai_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      user_id,
      created_at,
      updated_at`,
    [
      params.id ?? null,
      params.damaiOrderId ?? null,
      params.requestPath,
      JSON.stringify(params.requestBody),
      params.responseBody == null ? null : JSON.stringify(params.responseBody),
      params.syncStatus,
      params.orderId ?? null,
    ],
  );

  return rows[0];
}

export async function updateDamaiOrderSyncRecord(
  client: DBClient,
  schema: string,
  params: {
    id: string;
    responseBody?: unknown | null;
    syncStatus: Damai.DamaiOrderSyncStatus;
    orderId?: string | null;
    userId?: string | null;
  }
): Promise<Damai.DamaiOrderSyncRecord> {
  const { rows } = await client.query<Damai.DamaiOrderSyncRecord>(
    `UPDATE ${schema}.damai_order_sync_records
    SET
      response_body = $2::jsonb,
      sync_status = $3,
      order_id = COALESCE(order_id, $4::uuid),
      user_id = COALESCE(user_id, $5::uuid),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      damai_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      user_id,
      created_at,
      updated_at`,
    [
      params.id,
      params.responseBody == null ? null : JSON.stringify(params.responseBody),
      params.syncStatus,
      params.orderId ?? null,
      params.userId ?? null,
    ],
  );

  return rows[0];
}

export async function getFirstSuccessfulDamaiOrderSyncRecordByDamaiOrderId(
  client: DBClient,
  schema: string,
  damaiOrderId: string,
): Promise<Damai.DamaiOrderSyncRecord & { order_id: string, user_id: string } | null> {
  const { rows } = await client.query<Damai.DamaiOrderSyncRecord>(
    `SELECT
      id,
      damai_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      user_id,
      created_at
    FROM ${schema}.damai_order_sync_records
    WHERE damai_order_id = $1
      AND sync_status = 'SUCCESS'
    ORDER BY created_at ASC
    LIMIT 1`,
    [damaiOrderId],
  );

  return rows[0] ?? null;
}

export async function listDamaiOrderSyncRecordsByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<Damai.DamaiOrderSyncRecord[]> {
  const { rows } = await client.query<Damai.DamaiOrderSyncRecord>(
    `SELECT
      id,
      damai_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      user_id,
      created_at
    FROM ${schema}.damai_order_sync_records
    WHERE order_id = $1
    ORDER BY created_at DESC`,
    [orderId],
  );

  return rows;
}
