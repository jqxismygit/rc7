import { Pool, PoolClient } from 'pg';
import type { Xiecheng } from '@cr7/types';

type DBClient = Pool | PoolClient;

export type XiechengDataErrorCode =
  | 'TICKET_CATEGORY_NOT_FOUND'
  | 'TICKET_CATEGORY_NOT_BOUND'
  | 'INVALID_DATE_RANGE'
  | 'SESSION_DATE_OUT_OF_RANGE'
  | 'SESSION_END_TOO_FAR'
  | 'SYNC_QUANTITY_EXCEEDS_REMAINING';

export class XiechengDataError extends Error {
  code: XiechengDataErrorCode;

  constructor(message: string, code: XiechengDataErrorCode) {
    super(message);
    this.name = 'XiechengDataError';
    this.code = code;
  }
}

export async function createXcSyncLog(
  client: DBClient,
  schema: string,
  params: {
    sequenceId?: string;
    ticketCategoryId: string;
    serviceName: Xiecheng.XcServiceName;
    otaOptionId: string;
    syncItems: Xiecheng.XcSyncItem[];
    syncResponse: unknown;
    status: Xiecheng.XcSyncStatus;
  },
): Promise<Xiecheng.XcSyncLog> {
  const { rows } = await client.query<Xiecheng.XcSyncLog>(
    `INSERT INTO ${schema}.exhibit_xc_sync_logs (
      sequence_id,
      ticket_category_id,
      service_name,
      ota_option_id,
      sync_items,
      sync_response,
      status
    )
    VALUES (
      COALESCE($1::uuid, GEN_RANDOM_UUID()),
      $2,
      $3,
      $4,
      $5::jsonb,
      $6::jsonb,
      $7
    )
    RETURNING
      sequence_id,
      ticket_category_id,
      service_name,
      ota_option_id,
      sync_items,
      sync_response,
      status,
      created_at`,
    [
      params.sequenceId ?? null,
      params.ticketCategoryId,
      params.serviceName,
      params.otaOptionId,
      JSON.stringify(params.syncItems),
      params.syncResponse === undefined ? null : JSON.stringify(params.syncResponse),
      params.status,
    ],
  );

  return rows[0];
}

export async function listXcSyncLogs(
  client: DBClient,
  schema: string,
  params: {
    tid: string;
    serviceName?: Xiecheng.XcServiceName;
  },
): Promise<Xiecheng.XcSyncLog[]> {
  const values: unknown[] = [params.tid];
  const filters: string[] = ['ticket_category_id = $1'];

  if (params.serviceName) {
    values.push(params.serviceName);
    filters.push(`service_name = $${values.length}`);
  }

  const { rows } = await client.query<Xiecheng.XcSyncLog>(
    `SELECT
      sequence_id,
      ticket_category_id,
      service_name,
      ota_option_id,
      sync_items,
      sync_response,
      status,
      created_at
    FROM ${schema}.exhibit_xc_sync_logs
    WHERE ${filters.join(' AND ')}
    ORDER BY created_at DESC`,
    values,
  );

  return rows;
}
