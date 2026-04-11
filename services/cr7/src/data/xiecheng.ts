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
    otaOptionId: string | null;
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

export type XcOrderDataErrorCode =
  | 'XC_ORDER_SYNC_RECORD_NOT_FOUND';

export class XcOrderDataError extends Error {
  code: XcOrderDataErrorCode;

  constructor(message: string, code: XcOrderDataErrorCode) {
    super(message);
    this.name = 'XcOrderDataError';
    this.code = code;
  }
}

export async function createXcOrderSyncRecord(
  client: DBClient,
  schema: string,
  params: {
    id?: string;
    serviceName: Xiecheng.XcOrderServiceName;
    otaOrderId: string | null;
    sequenceId: string;
    requestHeader: Xiecheng.XcRequestHeader;
    requestBody:
      | Xiecheng.XcCreatePreOrderBody
      | Xiecheng.XcQueryOrderBody
      | Xiecheng.XcCancelPreOrderBody
      | Xiecheng.XcPayPreOrderBody
      | Xiecheng.XcCancelOrderBody;
    responseBody: unknown;
    phone: string | null;
    countryCode: string | null;
    totalAmount: number | null;
    syncStatus: Xiecheng.XcOrderSyncStatus;
    userId: string | null;
    orderId: string | null;
  },
): Promise<Xiecheng.XcOrderSyncRecord> {
  const { rows } = await client.query<Xiecheng.XcOrderSyncRecord>(
    `INSERT INTO ${schema}.xc_order_sync_records (
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id
    )
    VALUES (COALESCE($1::uuid, GEN_RANDOM_UUID()), $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
    RETURNING
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id,
      created_at`,
    [
      params.id ?? null,
      params.serviceName,
      params.otaOrderId,
      params.sequenceId,
      JSON.stringify(params.requestHeader),
      JSON.stringify(params.requestBody),
      JSON.stringify(params.responseBody),
      params.phone,
      params.countryCode,
      params.totalAmount,
      params.syncStatus,
      params.userId,
      params.orderId,
    ],
  );

  return rows[0];
}

export async function getXcOrderSyncRecordById(
  client: DBClient,
  schema: string,
  id: string,
): Promise<Xiecheng.XcOrderSyncRecord> {
  const { rows } = await client.query<Xiecheng.XcOrderSyncRecord>(
    `SELECT
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id,
      created_at
    FROM ${schema}.xc_order_sync_records
    WHERE id = $1`,
    [id],
  );

  if (rows.length === 0) {
    throw new XcOrderDataError('XcOrderSyncRecord not found', 'XC_ORDER_SYNC_RECORD_NOT_FOUND');
  }

  return rows[0];
}

export async function getFirstSuccessfulXcOrderSyncRecordByOtaOrderId(
  client: DBClient,
  schema: string,
  otaOrderId: string,
): Promise<Xiecheng.XcOrderSyncRecord | null> {
  const { rows } = await client.query<Xiecheng.XcOrderSyncRecord>(
    `SELECT
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id,
      created_at
    FROM ${schema}.xc_order_sync_records
    WHERE ota_order_id = $1
      AND sync_status = 'SUCCESS'
    ORDER BY created_at ASC
    LIMIT 1`,
    [otaOrderId],
  );

  return rows[0] ?? null;
}

export async function getLatestSuccessfulXcOrderSyncRecordByOtaOrderIdAndServiceName(
  client: DBClient,
  schema: string,
  otaOrderId: string,
  serviceName: Xiecheng.XcOrderServiceName,
): Promise<Xiecheng.XcOrderSyncRecord | null> {
  const { rows } = await client.query<Xiecheng.XcOrderSyncRecord>(
    `SELECT
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id,
      created_at
    FROM ${schema}.xc_order_sync_records
    WHERE ota_order_id = $1
      AND service_name = $2
      AND sync_status = 'SUCCESS'
    ORDER BY created_at DESC
    LIMIT 1`,
    [otaOrderId, serviceName],
  );

  return rows[0] ?? null;
}

export async function listXcOrderSyncRecordsByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<Xiecheng.XcOrderSyncRecord[]> {
  const { rows } = await client.query<Xiecheng.XcOrderSyncRecord>(
    `SELECT
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id,
      created_at
    FROM ${schema}.xc_order_sync_records
    WHERE order_id = $1
    ORDER BY created_at DESC`,
    [orderId],
  );

  return rows;
}

export async function listXcOrderSyncRecords(
  client: DBClient,
  schema: string,
  params: {
    limit: number;
    offset: number;
    otaOrderId?: string;
  },
): Promise<{ records: Xiecheng.XcOrderSyncRecord[]; total: number }> {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (params.otaOrderId) {
    values.push(params.otaOrderId);
    filters.push(`ota_order_id = $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const totalResult = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
    FROM ${schema}.xc_order_sync_records
    ${whereClause}`,
    values,
  );

  values.push(params.limit, params.offset);
  const { rows } = await client.query<Xiecheng.XcOrderSyncRecord>(
    `SELECT
      id,
      service_name,
      ota_order_id,
      sequence_id,
      request_header,
      request_body,
      response_body,
      phone,
      country_code,
      total_amount,
      sync_status,
      user_id,
      order_id,
      created_at
    FROM ${schema}.xc_order_sync_records
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}`,
    values,
  );

  return {
    records: rows,
    total: Number(totalResult.rows[0]?.total ?? 0),
  };
}
