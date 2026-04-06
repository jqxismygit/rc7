import { Pool, PoolClient } from 'pg';
import type { Mop } from '@cr7/types';

type DBClient = Pool | PoolClient;

export async function createMopOrderSyncRecord(
  client: DBClient,
  schema: string,
  params: {
    id?: string;
    myOrderId: string;
    requestPath: string;
    requestBody: unknown;
    responseBody?: unknown | null;
    syncStatus: Mop.MopOrderSyncStatus;
    orderId?: string | null;
  }
): Promise<Mop.MopOrderSyncRecord> {
  const { rows } = await client.query<Mop.MopOrderSyncRecord>(
    `INSERT INTO ${schema}.mop_order_sync_records (
      id,
      my_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id
    )
    VALUES (COALESCE($1::uuid, GEN_RANDOM_UUID()), $2, $3, $4::jsonb, $5::jsonb, $6, $7)
    RETURNING
      id,
      my_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      created_at,
      updated_at`,
    [
      params.id ?? null,
      params.myOrderId,
      params.requestPath,
      JSON.stringify(params.requestBody),
      params.responseBody == null ? null : JSON.stringify(params.responseBody),
      params.syncStatus,
      params.orderId ?? null,
    ],
  );

  return rows[0];
}

export async function listMopOrderSyncRecordsByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<Mop.MopOrderSyncRecord[]> {
  const { rows } = await client.query<Mop.MopOrderSyncRecord>(
    `SELECT
      id,
      my_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      created_at
    FROM ${schema}.mop_order_sync_records
    WHERE order_id = $1
    ORDER BY created_at DESC`,
    [orderId],
  );

  return rows;
}

export async function getFirstSuccessfulMopOrderSyncRecordByMyOrderId(
  client: DBClient,
  schema: string,
  myOrderId: string,
): Promise<Mop.MopOrderSyncRecord | null> {
  const { rows } = await client.query<Mop.MopOrderSyncRecord>(
    `SELECT
      id,
      my_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      user_id,
      created_at
    FROM ${schema}.mop_order_sync_records
    WHERE my_order_id = $1
      AND sync_status = 'SUCCESS'
    ORDER BY created_at ASC
    LIMIT 1`,
    [myOrderId],
  );

  return rows[0] ?? null;
}

export async function updateMopOrderSyncRecord(
  client: DBClient,
  schema: string,
  params: {
    id: string;
    responseBody?: unknown | null;
    syncStatus: Mop.MopOrderSyncStatus;
    orderId?: string | null;
    userId?: string | null;
  }
): Promise<Mop.MopOrderSyncRecord> {
  const { rows } = await client.query<Mop.MopOrderSyncRecord>(
    `UPDATE ${schema}.mop_order_sync_records
    SET
      response_body = $2::jsonb,
      sync_status = $3,
      order_id = COALESCE(order_id, $4::uuid),
      user_id = COALESCE(user_id, $5::uuid),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      my_order_id,
      request_path,
      request_body,
      response_body,
      sync_status,
      order_id,
      created_at`,
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
