import { Pool, PoolClient } from 'pg';
import type { Invoice } from '@cr7/types';

type DBClient = Pool | PoolClient;

export interface InvoiceApplicationRecord extends Invoice.InvoiceRecord {
  id: string;
  order_id: string;
  invoice_title: string;
  tax_no: string;
  email: string;
  status: Invoice.InvoiceStatus;
  sequence_id: string;
  invoice_no: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

type InvoiceApplicationDraft = Omit<InvoiceApplicationRecord,
  'id'
  | 'sequence_id'
  | 'status'
  | 'invoice_no'
  | 'created_at'
  | 'updated_at'
  | 'tax_no'
  | 'pdf_url'
> & {
  tax_no?: Invoice.InvoiceRecord['tax_no'];
};

type InvoiceApplyPersistResult = Pick<InvoiceApplicationRecord,
  'request' | 'response' | 'invoice_no'
>;

type InvoiceFailedPersistResult = Pick<InvoiceApplicationRecord,
  'request' | 'response'
>;

export async function createInvoiceApplication(
  client: DBClient,
  schema: string,
  params: InvoiceApplicationDraft,
) {
  const { rows } = await client.query<InvoiceApplicationRecord>(
    `WITH next_invoice_id AS (
      SELECT nextval(pg_get_serial_sequence('${schema}.invoices', 'id')) AS id
    )
    INSERT INTO ${schema}.invoices (
      id,
      order_id,
      user_id,
      invoice_title,
      tax_no,
      email,
      status,
      sequence_id,
      request,
      response
    )
    SELECT
      next_invoice_id.id,
      $1,
      $2,
      $3,
      $4,
      $5,
      'PENDING',
      CONCAT('JZWLJC', LPAD(next_invoice_id.id::text, 14, '0')),
      $6,
      $7
    FROM next_invoice_id
    RETURNING
      id,
      order_id,
      user_id,
      invoice_title,
      tax_no,
      email,
      status,
      sequence_id,
      invoice_no,
      request,
      response,
      created_at,
      updated_at`,
    [
      params.order_id,
      params.user_id,
      params.invoice_title,
      params.tax_no ?? '',
      params.email,
      params.request,
      params.response,
    ],
  );

  return rows[0];
}

export async function markInvoiceApplicationSuccess(
  client: DBClient,
  schema: string,
  id: string,
  result: Partial<InvoiceApplyPersistResult>,
) {
  const { rows } = await client.query<InvoiceApplicationRecord>(
    `UPDATE ${schema}.invoices
    SET
      status = 'SUCCESS',
      request = $2,
      response = $3,
      invoice_no = $4,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      order_id,
      user_id,
      invoice_title,
      tax_no,
      email,
      status,
      sequence_id,
      invoice_no,
      request,
      response,
      created_at,
      updated_at`,
    [
      id,
      result.request,
      result.response,
      result.invoice_no ?? null,
    ],
  );

  return rows[0];
}

export async function markInvoiceApplicationFailed(
  client: DBClient,
  schema: string,
  id: string,
  result: Partial<InvoiceFailedPersistResult>,
) {
  const { rows } = await client.query<InvoiceApplicationRecord>(
    `UPDATE ${schema}.invoices
    SET
      request = $2,
      response = $3,
      status = 'FAILED',
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      order_id,
      user_id,
      invoice_title,
      tax_no,
      email,
      status,
      sequence_id,
      invoice_no,
      request,
      response,
      created_at,
      updated_at`,
    [id, result.request, result.response],
  );

  return rows[0];
}

export async function listInvoiceApplicationsByUser(
  client: DBClient,
  schema: string,
  userId: string,
) {
  const { rows } = await client.query<InvoiceApplicationRecord>(
    `SELECT
      id,
      order_id,
      user_id,
      invoice_title,
      tax_no,
      email,
      status,
      sequence_id,
      invoice_no,
      request,
      response,
      created_at,
      updated_at
    FROM ${schema}.invoices
    WHERE user_id = $1
    ORDER BY created_at DESC`,
    [userId],
  );

  return rows;
}

export async function getInvoiceApplicationByOrder(
  client: DBClient,
  schema: string,
  orderId: string,
) {
  const { rows } = await client.query<InvoiceApplicationRecord>(
    `SELECT
      id,
      order_id,
      user_id,
      invoice_title,
      tax_no,
      email,
      status,
      sequence_id,
      invoice_no,
      request,
      response,
      created_at,
      updated_at
    FROM ${schema}.invoices
    WHERE order_id = $1
    ORDER BY created_at DESC
    LIMIT 1`,
    [orderId],
  );

  return rows[0] ?? null;
}

export async function getInvoicesByOrderIds(
  client: DBClient,
  schema: string,
  orderIds: string[],
): Promise<Map<string, Pick<InvoiceApplicationRecord, 'id' | 'invoice_title' | 'email' | 'status'>>> {
  if (orderIds.length === 0) return new Map();

  const { rows } = await client.query<Pick<InvoiceApplicationRecord, 'id' | 'order_id' | 'invoice_title' | 'email' | 'status'>>(
    `SELECT DISTINCT ON (order_id)
      id,
      order_id,
      invoice_title,
      email,
      status
    FROM ${schema}.invoices
    WHERE order_id = ANY($1::uuid[])
    ORDER BY order_id, created_at DESC`,
    [orderIds],
  );

  return new Map(rows.map(row => [row.order_id, {
    id: row.id,
    invoice_title: row.invoice_title,
    email: row.email,
    status: row.status,
  }]));
}
