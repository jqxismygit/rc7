import { Pool, PoolClient } from 'pg';

type DBClient = Pool | PoolClient;

const CODE_LENGTH = 12;
const CODE_PREFIX = 'C';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface CdkeyBatchRecord {
  id: string;
  exhibit_id: string;
  name: string;
  ticket_category_id: string;
  redeem_quantity: number;
  quantity: number;
  used_count: number;
  redeem_valid_until: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CdkeyRecord {
  id: string;
  batch_id: string;
  exhibit_id: string;
  ticket_category_id: string;
  code: string;
  redeem_quantity: number;
  redeem_valid_until: string;
  redeemed_session_id: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CdkeyBatchRowsResult = {
  batches: CdkeyBatchRecord[];
  total: number;
  page: number;
  limit: number;
};

export type CdkeyRowsResult = {
  codes: CdkeyRecord[];
  total: number;
  page: number;
  limit: number;
};

export type CDKEY_DATA_ERROR_CODES
  = | 'CDKEY_NOT_FOUND'
    | 'CDKEY_BATCH_NOT_FOUND'
    | 'CDKEY_ALREADY_USED'
    | 'CDKEY_EXPIRED'
    | 'CDKEY_SESSION_NOT_FOUND';

export class CdkeyDataError extends Error {
  code: CDKEY_DATA_ERROR_CODES;

  constructor(message: string, code: CDKEY_DATA_ERROR_CODES) {
    super(message);
    this.name = 'CdkeyDataError';
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

function buildCandidateCdkeyCode() {
  const payload = `${CODE_PREFIX}${randomBusinessPart(CODE_LENGTH - 3)}`;
  return `${payload}${buildLuhn2(payload)}`;
}

function buildCandidateCdkeyCodes(
  count: number,
  generatedCodes: Set<string>,
): string[] {
  const candidates: string[] = [];

  while (candidates.length < count) {
    const code = buildCandidateCdkeyCode();
    if (generatedCodes.has(code)) {
      continue;
    }

    generatedCodes.add(code);
    candidates.push(code);
  }

  return candidates;
}

export async function getCdkeyBatchById(
  client: DBClient,
  schema: string,
  batchId: string,
): Promise<CdkeyBatchRecord> {
  const { rows } = await client.query<CdkeyBatchRecord>(
    `SELECT
      b.id,
      b.exhibit_id,
      b.name,
      b.ticket_category_id,
      b.redeem_quantity,
      b.quantity,
      COALESCE(stats.used_count, 0)::int AS used_count,
      TO_CHAR(b.redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
      b.created_by,
      b.created_at,
      b.updated_at
    FROM ${schema}.exhibit_cdkey_batches b
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE c.redeemed_at IS NOT NULL) AS used_count
      FROM ${schema}.exhibit_cdkeys c
      WHERE c.batch_id = b.id
    ) stats ON TRUE
    WHERE b.id = $1
    LIMIT 1`,
    [batchId],
  );

  if (rows[0] === undefined) {
    throw new CdkeyDataError('CDKEY batch not found', 'CDKEY_BATCH_NOT_FOUND');
  }

  return rows[0];
}

export async function createCdkeyBatch(
  client: DBClient,
  schema: string,
  draft: {
    exhibit_id: string;
    name: string;
    ticket_category_id: string;
    redeem_quantity: number;
    quantity: number;
    redeem_valid_until: Date;
    created_by: string;
  },
): Promise<{ batch: CdkeyBatchRecord; codes: CdkeyRecord[] }> {
  const { rows: insertedRows } = await client.query<{ id: string }>(
    `INSERT INTO ${schema}.exhibit_cdkey_batches (
      exhibit_id,
      name,
      ticket_category_id,
      redeem_quantity,
      quantity,
      redeem_valid_until,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [
      draft.exhibit_id,
      draft.name,
      draft.ticket_category_id,
      draft.redeem_quantity,
      draft.quantity,
      draft.redeem_valid_until,
      draft.created_by,
    ],
  );

  const batchId = insertedRows[0]?.id;
  if (batchId === undefined) {
    throw new Error('Failed to create cdkey batch');
  }

  const insertedByCode = new Map<string, CdkeyRecord>();
  const generatedCodes = new Set<string>();
  const maxGeneratedCount = Math.max(draft.quantity * 20, 50);

  while (
    insertedByCode.size < draft.quantity
    && generatedCodes.size < maxGeneratedCount
  ) {
    const remaining = draft.quantity - insertedByCode.size;
    const generationBudget = maxGeneratedCount - generatedCodes.size;
    const candidateCount = Math.min(remaining, generationBudget);
    const candidates = buildCandidateCdkeyCodes(candidateCount, generatedCodes);

    const { rows } = await client.query<CdkeyRecord>(
      `WITH candidate_codes AS (
        SELECT UNNEST($4::varchar[]) AS code
      )
      INSERT INTO ${schema}.exhibit_cdkeys (
        batch_id,
        exhibit_id,
        ticket_category_id,
        code,
        redeem_quantity,
        redeem_valid_until
      )
      SELECT
        $1,
        $2,
        $3,
        candidate_codes.code,
        $5,
        $6
      FROM candidate_codes
      ON CONFLICT (code) DO NOTHING
      RETURNING
        id,
        batch_id,
        exhibit_id,
        ticket_category_id,
        code,
        redeem_quantity,
        TO_CHAR(redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
        redeemed_session_id,
        redeemed_by,
        redeemed_at,
        created_at,
        updated_at`,
      [
        batchId,
        draft.exhibit_id,
        draft.ticket_category_id,
        candidates,
        draft.redeem_quantity,
        draft.redeem_valid_until,
      ],
    );

    for (const row of rows) {
      insertedByCode.set(row.code, row);
    }
  }

  if (insertedByCode.size !== draft.quantity) {
    throw new Error('Failed to generate unique cdkey code');
  }

  const codes = [...insertedByCode.values()];
  const batch = await getCdkeyBatchById(client, schema, batchId);
  return { batch, codes };
}

export async function listCdkeyBatches(
  client: DBClient,
  schema: string,
  exhibitId: string,
  options: {
    page: number;
    limit: number;
  },
): Promise<CdkeyBatchRowsResult> {
  const { page, limit } = options;
  const offset = (page - 1) * limit;

  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
    FROM ${schema}.exhibit_cdkey_batches
    WHERE exhibit_id = $1`,
    [exhibitId],
  );

  const total = parseInt(countRows[0]?.total ?? '0', 10);

  const { rows } = await client.query<CdkeyBatchRecord>(
    `SELECT
      b.id,
      b.exhibit_id,
      b.name,
      b.ticket_category_id,
      b.redeem_quantity,
      b.quantity,
      COALESCE(stats.used_count, 0)::int AS used_count,
      TO_CHAR(b.redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
      b.created_by,
      b.created_at,
      b.updated_at
    FROM ${schema}.exhibit_cdkey_batches b
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE c.redeemed_at IS NOT NULL) AS used_count
      FROM ${schema}.exhibit_cdkeys c
      WHERE c.batch_id = b.id
    ) stats ON TRUE
    WHERE b.exhibit_id = $1
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3`,
    [exhibitId, limit, offset],
  );

  return {
    batches: rows,
    total,
    page,
    limit,
  };
}

export async function listCdkeysByBatch(
  client: DBClient,
  schema: string,
  batchId: string,
  options: {
    page: number;
    limit: number;
  },
): Promise<CdkeyRowsResult> {
  const { page, limit } = options;
  const offset = (page - 1) * limit;

  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
    FROM ${schema}.exhibit_cdkeys
    WHERE batch_id = $1`,
    [batchId],
  );

  const total = parseInt(countRows[0]?.total ?? '0', 10);

  const { rows } = await client.query<CdkeyRecord>(
    `SELECT
      c.id,
      c.batch_id,
      c.exhibit_id,
      c.ticket_category_id,
      c.code,
      c.redeem_quantity,
      TO_CHAR(c.redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
      c.redeemed_session_id,
      c.redeemed_by,
      c.redeemed_at,
      c.created_at,
      c.updated_at
    FROM ${schema}.exhibit_cdkeys c
    WHERE c.batch_id = $1
    ORDER BY c.created_at ASC, c.code ASC
    LIMIT $2 OFFSET $3`,
    [batchId, limit, offset],
  );

  return {
    codes: rows,
    total,
    page,
    limit,
  };
}

export async function getCdkeyByCode(
  client: DBClient,
  schema: string,
  code: string,
): Promise<CdkeyRecord> {
  const { rows } = await client.query<CdkeyRecord>(
    `SELECT
      c.id,
      c.batch_id,
      c.exhibit_id,
      c.ticket_category_id,
      c.code,
      c.redeem_quantity,
      TO_CHAR(c.redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
      c.redeemed_session_id,
      c.redeemed_by,
      c.redeemed_at,
      c.created_at,
      c.updated_at
    FROM ${schema}.exhibit_cdkeys c
    WHERE c.code = $1
    LIMIT 1`,
    [code],
  );

  if (rows[0] === undefined) {
    throw new CdkeyDataError('CDKEY not found', 'CDKEY_NOT_FOUND');
  }

  return rows[0];
}

export async function getCdkeysByCodes(
  client: DBClient,
  schema: string,
  codes: string[],
): Promise<Map<string, CdkeyRecord>> {
  if (codes.length === 0) {
    return new Map();
  }

  const { rows } = await client.query<CdkeyRecord>(
    `SELECT
      c.id,
      c.batch_id,
      c.exhibit_id,
      c.ticket_category_id,
      c.code,
      c.redeem_quantity,
      TO_CHAR(c.redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
      c.redeemed_session_id,
      c.redeemed_by,
      c.redeemed_at,
      c.created_at,
      c.updated_at
    FROM ${schema}.exhibit_cdkeys c
    WHERE c.code = ANY($1::varchar[])`,
    [[...new Set(codes)]],
  );

  return new Map(rows.map(row => [row.code, row]));
}

export async function redeemCdkey(
  client: DBClient,
  schema: string,
  input: {
    code: string;
    sid: string;
    redeemed_by: string;
  },
): Promise<CdkeyRecord | null> {
  const { rows } = await client.query<CdkeyRecord>(
    `UPDATE ${schema}.exhibit_cdkeys c
    SET
      redeemed_session_id = $2,
      redeemed_by = $3,
      redeemed_at = NOW(),
      updated_at = NOW()
    WHERE c.code = $1
      AND c.redeemed_at IS NULL
    RETURNING
      c.id,
      c.batch_id,
      c.exhibit_id,
      c.ticket_category_id,
      c.code,
      c.redeem_quantity,
      TO_CHAR(c.redeem_valid_until, 'YYYY-MM-DD') AS redeem_valid_until,
      c.redeemed_session_id,
      c.redeemed_by,
      c.redeemed_at,
      c.created_at,
      c.updated_at`,
    [input.code, input.sid, input.redeemed_by],
  );

  return rows[0] ?? null;
}
