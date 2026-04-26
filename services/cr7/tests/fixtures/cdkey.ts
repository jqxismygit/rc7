import { Server } from 'http';
import { expect } from 'vitest';
import { Cdkey, Redeem } from '@cr7/types';
import { getJSON, postJSON } from '../lib/api.js';
import { assertRedeem } from './redeem.js';
import { isValidLuhnCode } from '../../src/utils/luhn-code.js';

const CODE_LENGTH = 12;
const CODE_PREFIX = 'C';

export function isValidCdkeyLuhn(code: string) {
  return isValidLuhnCode(code, {
    prefix: CODE_PREFIX,
    codeLength: CODE_LENGTH,
  });
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

  expect(result).toHaveProperty('id', expect.any(String));
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

export async function redeemCdkey(
  server: Server,
  token: string,
  sid: string,
  body: {
    code: string;
  },
): Promise<Redeem.RedemptionCode> {
  const result = await postJSON<Redeem.RedemptionCode>(
    server,
    `/cdkeys/sessions/${sid}/redeem`,
    { token, body },
  );

  assertRedeem(result);
  return result;
}
