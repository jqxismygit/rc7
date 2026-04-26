import { addDays, startOfDay } from 'date-fns';
import { Pool, PoolClient } from 'pg';
import type { Redeem } from '@cr7/types';

type DBClient = Pool | PoolClient;

const CODE_LENGTH = 12;
const CODE_PREFIX = 'R';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

type RedemptionRow = Redeem.RedemptionRow;

type RedemptionListRow = {
  exhibit_id: string;
  source: Redeem.RedemptionSource;
  order_id: string | null;
  cdkey: string | null;
  code: string;
  session_id: string;
  status: Redeem.RedemptionStatus;
  quantity: number;
  valid_from: string;
  valid_until: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

type RedemptionListRowsResult = {
  redemptions: RedemptionRow[];
  total: number;
  page: number;
  limit: number;
};

export type REDEEM_DATA_ERROR_CODES
  = | 'ORDER_NOT_FOUND'
    | 'ORDER_NOT_REDEEMABLE'
    | 'ORDER_REFUND_IN_PROGRESS'
    | 'REDEMPTION_NOT_FOUND'
    | 'REDEMPTION_ALREADY_REDEEMED'
    | 'REDEMPTION_EXPIRED'
    | 'REDEMPTION_NOT_YET_VALID'
    | 'REDEMPTION_ALREADY_OWNED';

export class RedeemDataError extends Error {
  code: REDEEM_DATA_ERROR_CODES;
  data: Record<string, unknown> | null;

  constructor(
    message: string, code: REDEEM_DATA_ERROR_CODES,
    data: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = 'RedeemDataError';
    this.code = code;
    this.data = data;
  }
}

function toLuhnDigits(input: string) {
  const digits: number[] = [];

  for (const char of input) {
    if (/^[0-9]$/.test(char)) {
      digits.push(Number(char));
      continue;
    }

    const index = ALPHABET.indexOf(char);
    if (index < 0) {
      continue;
    }

    const base36Value = index + 2;
    for (const digit of String(base36Value)) {
      digits.push(Number(digit));
    }
  }

  return digits;
}

function calculateLuhnCheckDigit(digits: number[]) {
  let sum = 0;
  let shouldDouble = true;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = digits[index];
    if (shouldDouble) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}

function buildLuhn2(input10: string) {
  const checkDigit1 = calculateLuhnCheckDigit(toLuhnDigits(input10));
  const checkDigit2 = calculateLuhnCheckDigit(toLuhnDigits(input10 + String(checkDigit1)));
  return `${checkDigit1}${checkDigit2}`;
}

function randomBusinessPart(length: number) {
  return Array.from({ length })
    .map(() => ALPHABET[Math.floor(Math.random() * ALPHABET.length)])
    .join('');
}

function buildCandidateCode() {
  const payload = `${CODE_PREFIX}${randomBusinessPart(CODE_LENGTH - 3)}`;
  return `${payload}${buildLuhn2(payload)}`;
}

export async function getRedemptionRowByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<RedemptionRow> {
  const { rows } = await client.query<RedemptionRow>(
    `SELECT
      exhibit_id,
      order_id,
      code,
      source,
      cdkey,
      session_id,
      status,
      quantity,
      valid_from,
      valid_until,
      redeemed_at,
      redeemed_by,
      owner_user_id,
      created_at,
      updated_at
    FROM ${schema}.exhibit_redemption_codes
    WHERE order_id = $1
      AND source = 'ORDER'
    LIMIT 1`,
    [orderId],
  );

  const row = rows[0];
  if (row === undefined) {
    throw new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE');
  }

  return row;
}

export async function getRedemptionListByUser(
  client: DBClient,
  schema: string,
  userId: string,
  options: {
    status?: Redeem.RedemptionStatus;
    page: number;
    limit: number;
  },
): Promise<RedemptionListRowsResult> {
  const { status, page, limit } = options;
  const offset = (page - 1) * limit;

  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
    FROM ${schema}.exhibit_redemption_codes rc
    WHERE rc.owner_user_id = $1
      AND ($2::text IS NULL OR rc.status = $2)`,
    [userId, status ?? null],
  );

  const total = parseInt(countRows[0]?.total ?? '0', 10);

  const { rows } = await client.query<RedemptionListRow>(
    `SELECT
      rc.exhibit_id,
      rc.order_id,
      rc.code,
      rc.source,
      rc.cdkey,
      rc.session_id,
      rc.status,
      rc.quantity,
      rc.valid_from,
      rc.valid_until,
      rc.redeemed_at,
      rc.redeemed_by,
      rc.owner_user_id,
      rc.created_at,
      rc.updated_at
    FROM ${schema}.exhibit_redemption_codes rc
    WHERE rc.owner_user_id = $1
      AND ($2::text IS NULL OR rc.status = $2)
    ORDER BY rc.created_at DESC
    LIMIT $3 OFFSET $4`,
    [userId, status ?? null, limit, offset],
  );

  return {
    redemptions: rows,
    total,
    page,
    limit,
  };
}

export async function getRedemptionRowByCode(
  client: DBClient,
  schema: string,
  code: string,
): Promise<RedemptionRow> {
  const { rows } = await client.query<RedemptionRow>(
    `SELECT
      exhibit_id,
      order_id,
      code,
      source,
      cdkey,
      session_id,
      status,
      quantity,
      valid_from,
      valid_until,
      redeemed_at,
      redeemed_by,
      owner_user_id,
      created_at,
      updated_at
    FROM ${schema}.exhibit_redemption_codes
    WHERE code = $1
    ORDER BY created_at DESC
    LIMIT 1`,
    [code],
  );

  if (rows[0] === undefined) {
    throw new RedeemDataError('Redemption code not found', 'REDEMPTION_NOT_FOUND');
  }

  return rows[0];
}

export async function upsertRedemptionCodeByOrderId(
  client: DBClient,
  schema: string,
  exhibitId: string,
  orderId: string,
  sessionId: string,
  userId: string,
  quantity: number,
  sessionDate: Date,
  validDurationDays: number,
): Promise<string> {
  const valid_until = addDays(sessionDate, validDurationDays);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = buildCandidateCode();

    try {
      const { rows } = await client.query<RedemptionRow>(
        `WITH inserted AS (
          INSERT INTO ${schema}.exhibit_redemption_codes (
            code,
            source,
            exhibit_id,
            order_id,
            session_id,
            owner_user_id,
            status,
            quantity,
            valid_from,
            valid_until
          )
          VALUES ($1, 'ORDER', $2, $3, $8, $7, 'UNREDEEMED', $4, $5, $6)
          ON CONFLICT (order_id) DO NOTHING
          RETURNING
            exhibit_id,
            order_id,
            code
        )
        SELECT *
        FROM inserted
        UNION ALL
        SELECT
          exhibit_id,
          order_id,
          code
        FROM ${schema}.exhibit_redemption_codes
        WHERE order_id = $3
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1`,
        [code, exhibitId, orderId, quantity, sessionDate, valid_until, userId, sessionId],
      );

      if (rows[0] !== undefined) {
        return rows[0].code;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique redemption code');
}

export async function createRedemptionCodeByCdkey(
  client: DBClient,
  schema: string,
  input: {
    exhibit_id: string;
    cdkey: string;
    session_id: string;
    owner_user_id: string;
    quantity: number;
    session_date: Date;
  },
): Promise<RedemptionRow> {
  const validFrom = startOfDay(input.session_date);
  const validUntil = addDays(validFrom, 1);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = buildCandidateCode();

    try {
      const { rows } = await client.query<RedemptionRow>(
        `WITH inserted AS (
          INSERT INTO ${schema}.exhibit_redemption_codes (
            code,
            source,
            exhibit_id,
            order_id,
            cdkey,
            session_id,
            owner_user_id,
            status,
            quantity,
            valid_from,
            valid_until
          )
          VALUES (
            $1,
            'CDKEY',
            $2,
            NULL,
            $3,
            $4,
            $5,
            'UNREDEEMED',
            $6,
            $7,
            $8
          )
          ON CONFLICT (cdkey) DO NOTHING
          RETURNING
            exhibit_id,
            order_id,
            code,
            source,
            cdkey,
            session_id,
            status,
            quantity,
            valid_from,
            valid_until,
            redeemed_at,
            redeemed_by,
            owner_user_id,
            created_at,
            updated_at
        )
        SELECT *
        FROM inserted
        UNION ALL
        SELECT
          exhibit_id,
          order_id,
          code,
          source,
          cdkey,
          session_id,
          status,
          quantity,
          valid_from,
          valid_until,
          redeemed_at,
          redeemed_by,
          owner_user_id,
          created_at,
          updated_at
        FROM ${schema}.exhibit_redemption_codes
        WHERE cdkey = $3
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1`,
        [
          code,
          input.exhibit_id,
          input.cdkey,
          input.session_id,
          input.owner_user_id,
          input.quantity,
          validFrom,
          validUntil,
        ],
      );

      if (rows[0] !== undefined) {
        return rows[0];
      }
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique redemption code');
}

export async function redeemCode(
  client: DBClient,
  schema: string,
  code: string,
  redeemedBy: string,
): Promise<RedemptionRow> {
  await client.query(
    `UPDATE ${schema}.exhibit_redemption_codes
    SET
      status = 'REDEEMED',
      redeemed_at = NOW(),
      redeemed_by = $2,
      updated_at = NOW()
    WHERE code = $1`,
    [code, redeemedBy],
  );

  return getRedemptionRowByCode(client, schema, code);
}

export async function transferRedemptionCode(
  client: DBClient,
  schema: string,
  code: string,
  toUserId: string,
  fromUserId: string,
): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    `WITH updated AS (
      UPDATE ${schema}.exhibit_redemption_codes rc
      SET
        owner_user_id = $3,
        updated_at = NOW()
      WHERE rc.code = $1 AND rc.owner_user_id = $2
      RETURNING
        rc.code,
        rc.exhibit_id,
        $2 AS from_user_id
    ),
    inserted AS (
      INSERT INTO ${schema}.exhibit_redemption_code_transfers
      ( code, exhibit_id, from_user_id, to_user_id)
      SELECT code, exhibit_id, from_user_id, $3
      FROM updated
      RETURNING id
    )
    SELECT id FROM inserted`,
    [code, fromUserId, toUserId],
  );

  if (rows.length === 0) {
    throw new RedeemDataError('Redemption code not found', 'REDEMPTION_NOT_FOUND');
  }
}

export async function getTransfersByCode(
  client: DBClient,
  schema: string,
  code: string,
): Promise<Redeem.RedemptionTransfer[]> {
  const { rows } = await client.query<Redeem.RedemptionTransfer>(
    `SELECT
      id,
      code,
      exhibit_id,
      from_user_id,
      to_user_id,
      created_at
    FROM ${schema}.exhibit_redemption_code_transfers
    WHERE code = $1
    ORDER BY created_at ASC`,
    [code],
  );

  return rows;
}
