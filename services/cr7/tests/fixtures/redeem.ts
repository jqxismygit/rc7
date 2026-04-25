import { Server } from 'node:http';
import { Redeem } from '@cr7/types';
import { expect } from 'vitest';
import { getJSON, postJSON } from '../lib/api.js';
import { toDateLabel } from '../lib/relative-date.js';

const CODE_LENGTH = 12;
const CODE_PREFIX = 'R';
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
      const text = String(base36Value);
      for (const d of text) {
        digits.push(Number(d));
      }
    }
  }
  return digits;
}

function calculateLuhnCheckDigit(digits: number[]) {
  let sum = 0;
  let shouldDouble = true;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits[i];
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

export function isValidRedemptionCodeLuhn(code: string) {
  if (code.length !== CODE_LENGTH || code.startsWith(CODE_PREFIX) === false) {
    return false;
  }

  const payload = code.slice(0, 10);
  const expected = buildLuhn2(payload);
  return code.slice(10) === expected;
}

export function assertRedeem(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('order_id', expect.any(String));
  expect(data).toHaveProperty('code', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('status', expect.stringMatching(/^(UNREDEEMED|REDEEMED)$/));
  expect(data).toHaveProperty('quantity', expect.any(Number));
  expect(data).toHaveProperty('valid_from', expect.any(String));
  expect(data).toHaveProperty('valid_until', expect.any(String));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
  expect(data).toHaveProperty('order', expect.any(Object));
  expect(data).toHaveProperty('exhibition', expect.any(Object));
  expect(data).toHaveProperty('session', expect.any(Object));
  expect(data).toHaveProperty('items', expect.any(Array));
  expect(data).not.toHaveProperty('id');

  const redeem = data as Redeem.RedemptionCodeWithOrder;
  if (redeem.redeemed_at !== null) {
    expect(redeem.redeemed_at).toEqual(expect.any(String));
  }
  if (redeem.redeemed_by !== null) {
    expect(redeem.redeemed_by).toEqual(expect.any(String));
  }

  expect(redeem.order).toHaveProperty('id', expect.any(String));
  expect(redeem.order).toHaveProperty('user_id', expect.any(String));
  expect(redeem.order).toHaveProperty('exhibit_id', expect.any(String));
  expect(redeem.order).toHaveProperty('session_id', expect.any(String));
  expect(redeem.order).toHaveProperty('total_amount', expect.any(Number));
  expect(redeem.order).toHaveProperty('status', expect.any(String));

  expect(redeem.exhibition).toHaveProperty('id', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('name', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('description', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('location', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('city', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('venue_name', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('start_date', expect.any(String));
  expect(redeem.exhibition).toHaveProperty('end_date', expect.any(String));

  expect(redeem.session).toHaveProperty('id', expect.any(String));
  expect(redeem.session).toHaveProperty('session_date', expect.any(String));
  expect(redeem.session).toHaveProperty('opening_time', expect.any(String));
  expect(redeem.session).toHaveProperty('closing_time', expect.any(String));
  expect(redeem.session).toHaveProperty('last_entry_time', expect.any(String));

  for (const item of redeem.items) {
    expect(item).toHaveProperty('id', expect.any(String));
    expect(item).toHaveProperty('ticket_category_id', expect.any(String));
    expect(item).toHaveProperty('quantity', expect.any(Number));
    expect(item).toHaveProperty('unit_price', expect.any(Number));
    expect(item).toHaveProperty('category_name', expect.any(String));
  }
}

export function assertRedeemList(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('redemptions', expect.any(Array));
  expect(data).toHaveProperty('total', expect.any(Number));
  expect(data).toHaveProperty('page', expect.any(Number));
  expect(data).toHaveProperty('limit', expect.any(Number));

  const list = data as Redeem.RedemptionCodeListResult;
  for (const redemption of list.redemptions) {
    assertRedeem(redemption);
  }
}

export async function getOrderRedemption(
  server: Server,
  orderId: string,
  token: string,
) {
  const redemption = await getJSON<Redeem.RedemptionCodeWithOrder>(
    server,
    `/orders/${orderId}/redemption`,
    { token },
  );

  assertRedeem(redemption);
  return redemption;
}

export async function redeemCode(
  server: Server,
  exhibitionId: string,
  code: string,
  token: string,
) {
  return postJSON<Redeem.RedemptionCodeWithOrder>(
    server,
    `/exhibition/${exhibitionId}/redeem`,
    {
      token,
      body: { code },
    },
  );
}

export async function listMyRedemptions(
  server: Server,
  token: string,
  query: {
    status?: Redeem.RedemptionStatus;
    page?: number;
    limit?: number;
  } = {},
) {
  const redemptionList = await getJSON<Redeem.RedemptionCodeListResult>(
    server,
    '/redemptions',
    { token, query },
  );

  assertRedeemList(redemptionList);
  return redemptionList;
}

export function toSessionDateLabel(value: string) {
  return toDateLabel(value);
}

export async function transferRedemptionCode(
  server: Server,
  code: string,
  token: string,
): Promise<null> {
  return postJSON<null>(
    server,
    '/redemptions/transfer',
    { token, body: { code } },
  );
}

export async function getRedemptionTransfers(
  server: Server,
  code: string,
  token: string,
): Promise<Redeem.RedemptionTransferListResult> {
  return getJSON<Redeem.RedemptionTransferListResult>(
    server,
    `/redemptions/${code}/transfers`,
    { token },
  );
}
