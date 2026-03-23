import { addDays, addSeconds } from 'date-fns';
import { Pool, PoolClient } from 'pg';
import type { Order, Redeem } from '@cr7/types';

type DBClient = Pool | PoolClient;

const CODE_LENGTH = 12;
const CODE_PREFIX = 'R';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

type RedemptionRow = Redeem.RedemptionCode;

type RedemptionItemInput = Redeem.RedemptionCodeWithOrder['items'][number];

export type REDEEM_DATA_ERROR_CODES =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_REDEEMABLE'
  | 'REDEMPTION_NOT_FOUND'
  | 'REDEMPTION_ALREADY_REDEEMED'
  | 'REDEMPTION_EXPIRED';

export class RedeemDataError extends Error {
  code: REDEEM_DATA_ERROR_CODES;

  constructor(message: string, code: REDEEM_DATA_ERROR_CODES) {
    super(message);
    this.name = 'RedeemDataError';
    this.code = code;
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

function toValidityStartDate(sessionDate: Date) {
  return new Date(Date.UTC(
    sessionDate.getFullYear(),
    sessionDate.getMonth(),
    sessionDate.getDate(),
  ));
}

function buildValidity(sessionDate: Date, validDurationDays: number) {
  const fromDate = toValidityStartDate(sessionDate);
  const untilDate = addDays(fromDate, validDurationDays - 1);
  const untilEndOfDay = addSeconds(untilDate, 23 * 3600 + 59 * 60 + 59);
  return {
    valid_from: fromDate.toISOString(),
    valid_until: untilEndOfDay.toISOString(),
  };
}

function buildRedemptionWithOrder(
  row: RedemptionRow,
  order: Order.OrderWithItems,
  items: RedemptionItemInput[],
): Redeem.RedemptionCodeWithOrder {
  return {
    exhibit_id: row.exhibit_id,
    order_id: row.order_id,
    code: row.code,
    status: row.status,
    quantity: row.quantity,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    redeemed_at: row.redeemed_at,
    redeemed_by: row.redeemed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    order: {
      id: order.id,
      user_id: order.user_id,
      exhibit_id: order.exhibit_id,
      session_id: order.session_id,
      total_amount: order.total_amount,
      status: order.status,
    },
    items,
  };
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
      status,
      quantity,
      valid_from,
      valid_until,
      redeemed_at,
      redeemed_by,
      created_at,
      updated_at
    FROM ${schema}.exhibit_redemption_codes
    WHERE order_id = $1
    LIMIT 1`,
    [orderId],
  );

  const row = rows[0];
  if (row === undefined) {
    throw new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE');
  }

  return row;
}

export async function getRedemptionRowByCode(
  client: DBClient,
  schema: string,
  exhibitId: string,
  code: string,
): Promise<RedemptionRow> {
  const { rows } = await client.query<RedemptionRow>(
    `SELECT
      exhibit_id,
      order_id,
      code,
      status,
      quantity,
      valid_from,
      valid_until,
      redeemed_at,
      redeemed_by,
      created_at,
      updated_at
    FROM ${schema}.exhibit_redemption_codes
    WHERE exhibit_id = $1
      AND code = $2
    LIMIT 1`,
    [exhibitId, code],
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
  quantity: number,
  sessionDate: Date,
  validDurationDays: number,
): Promise<string> {
  const { valid_from, valid_until } = buildValidity(sessionDate, validDurationDays);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = buildCandidateCode();

    try {
      const { rows } = await client.query<RedemptionRow>(
        `WITH inserted AS (
          INSERT INTO ${schema}.exhibit_redemption_codes (
            code,
            exhibit_id,
            order_id,
            status,
            quantity,
            valid_from,
            valid_until
          )
          VALUES ($1, $2, $3, 'UNREDEEMED', $4, $5, $6)
          ON CONFLICT (order_id) DO NOTHING
          RETURNING
            exhibit_id,
            order_id,
            code,
            status,
            quantity,
            valid_from,
            valid_until,
            redeemed_at,
            redeemed_by,
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
          status,
          quantity,
          valid_from,
          valid_until,
          redeemed_at,
          redeemed_by,
          created_at,
          updated_at
        FROM ${schema}.exhibit_redemption_codes
        WHERE order_id = $3
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1`,
        [code, exhibitId, orderId, quantity, valid_from, valid_until],
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

export async function redeemCode(
  client: DBClient,
  schema: string,
  exhibitId: string,
  code: string,
  redeemedBy: string,
  order: Order.OrderWithItems,
  items: RedemptionItemInput[],
): Promise<Redeem.RedemptionCodeWithOrder> {
  const redemption = await getRedemptionRowByCode(client, schema, exhibitId, code);

  if (redemption.status === 'REDEEMED') {
    throw new RedeemDataError('Redemption code already redeemed', 'REDEMPTION_ALREADY_REDEEMED');
  }

  const now = new Date();
  const validFrom = new Date(redemption.valid_from);
  const validUntil = new Date(redemption.valid_until);
  if (now < validFrom || now > validUntil) {
    throw new RedeemDataError('Redemption code expired', 'REDEMPTION_EXPIRED');
  }

  await client.query(
    `UPDATE ${schema}.exhibit_redemption_codes
    SET
      status = 'REDEEMED',
      redeemed_at = NOW(),
      redeemed_by = $3,
      updated_at = NOW()
    WHERE exhibit_id = $1
      AND code = $2`,
    [exhibitId, code, redeemedBy],
  );

  const updated = await getRedemptionRowByCode(client, schema, exhibitId, code);

  return buildRedemptionWithOrder(updated, order, items);
}