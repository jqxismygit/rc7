import { Server } from 'http';
import { expect } from 'vitest';
import { Cdkey } from '@cr7/types';
import { getJSON, postJSON } from '../lib/api.js';

const CODE_LENGTH = 12;
const CODE_PREFIX = 'C';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function toLuhnDigits(input: string) {
  const digits: number[] = [];
  for (const char of input) {
    if (/^[0-9]$/.test(char)) {
      digits.push(Number(char));
      continue;
    }

    const index = ALPHABET.indexOf(char);
    if (index >= 0) {
      const base36Value = index + 2;
      for (const digit of String(base36Value)) {
        digits.push(Number(digit));
      }
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
  const first = calculateLuhnCheckDigit(toLuhnDigits(input10));
  const second = calculateLuhnCheckDigit(toLuhnDigits(input10 + String(first)));
  return `${first}${second}`;
}

export function isValidCdkeyLuhn(code: string) {
  if (code.length !== CODE_LENGTH || code.startsWith(CODE_PREFIX) === false) {
    return false;
  }

  const payload = code.slice(0, 10);
  return code.slice(10) === buildLuhn2(payload);
}

export function assertCdkeyBatch(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('exhibition.id', expect.any(String));
  expect(data).toHaveProperty('exhibition.name', expect.any(String));
  expect(data).toHaveProperty('name', expect.any(String));
  expect(data).toHaveProperty('ticket_category.id', expect.any(String));
  expect(data).toHaveProperty('ticket_category.name', expect.any(String));
  expect(data).toHaveProperty('ticket_category.list_price', expect.any(Number));
  expect(data).toHaveProperty('redeem_quantity', expect.any(Number));
  expect(data).toHaveProperty('quantity', expect.any(Number));
  expect(data).toHaveProperty('used_count', expect.any(Number));
  expect(data).toHaveProperty('redeem_valid_until', expect.any(String));
  expect(data).toHaveProperty('created_by', expect.any(String));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}

export function assertCdkey(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('batch_id', expect.any(String));
  expect(data).toHaveProperty('exhibition.id', expect.any(String));
  expect(data).toHaveProperty('exhibition.name', expect.any(String));
  expect(data).toHaveProperty('ticket_category.id', expect.any(String));
  expect(data).toHaveProperty('ticket_category.name', expect.any(String));
  expect(data).toHaveProperty('ticket_category.list_price', expect.any(Number));
  expect(data).toHaveProperty('code', expect.any(String));
  expect(data).toHaveProperty('status', expect.stringMatching(/^(UNUSED|USED)$/));
  expect(data).toHaveProperty('redeem_quantity', expect.any(Number));
  expect(data).toHaveProperty('redeem_valid_until', expect.any(String));
  expect(data).toHaveProperty('redeemed_session');
  expect(data).toHaveProperty('redeemed_by');

  const redeemedBy = (data as { redeemed_by: null | { id: string; phone: string } }).redeemed_by;
  if (redeemedBy !== null) {
    expect(redeemedBy).toHaveProperty('id', expect.any(String));
    expect(redeemedBy).toHaveProperty('phone', expect.any(String));
  }
  expect(data).toHaveProperty('redeemed_at');
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
}

export async function createCdkeyBatch(
  server: Server,
  token: string,
  body: {
    eid: string;
    name: string;
    ticket_category_id: string;
    redeem_quantity: number;
    quantity: number;
    redeem_valid_until: string;
  },
): Promise<Cdkey.CreateCdkeyBatchResult> {
  const result = await postJSON<Cdkey.CreateCdkeyBatchResult>(
    server,
    '/cdkeys/batches',
    { token, body },
  );

  assertCdkeyBatch(result.batch);
  for (const code of result.codes) {
    assertCdkey(code);
  }
  return result;
}

export async function listCdkeyBatches(
  server: Server,
  token: string,
  query: {
    eid: string;
    page?: number;
    limit?: number;
  },
): Promise<Cdkey.CdkeyBatchListResult> {
  const result = await getJSON<Cdkey.CdkeyBatchListResult>(
    server,
    '/cdkeys/batches',
    { token, query },
  );

  expect(result).toHaveProperty('batches', expect.any(Array));
  expect(result).toHaveProperty('total', expect.any(Number));
  expect(result).toHaveProperty('page', expect.any(Number));
  expect(result).toHaveProperty('limit', expect.any(Number));

  for (const batch of result.batches) {
    assertCdkeyBatch(batch);
  }
  return result;
}

export async function listCdkeysByBatch(
  server: Server,
  token: string,
  batchId: string,
  query: {
    page?: number;
    limit?: number;
  } = {},
): Promise<Cdkey.CdkeyListResult> {
  const result = await getJSON<Cdkey.CdkeyListResult>(
    server,
    `/cdkeys/batches/${batchId}/codes`,
    { token, query },
  );

  expect(result).toHaveProperty('codes', expect.any(Array));
  expect(result).toHaveProperty('total', expect.any(Number));
  expect(result).toHaveProperty('page', expect.any(Number));
  expect(result).toHaveProperty('limit', expect.any(Number));

  for (const code of result.codes) {
    assertCdkey(code);
  }
  return result;
}

export async function getCdkeyByCode(
  server: Server,
  token: string,
  code: string,
): Promise<Cdkey.Cdkey> {
  const result = await getJSON<Cdkey.Cdkey>(
    server,
    `/cdkeys/${code}`,
    { token },
  );

  assertCdkey(result);
  return result;
}
