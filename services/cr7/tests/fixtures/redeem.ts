import { Server } from 'node:http';
import { Redeem } from '@cr7/types';
import { expect } from 'vitest';
import { getJSON, postJSON } from '../lib/api.js';
import { toDateLabel } from '../lib/relative-date.js';
import { isValidLuhnCode } from '../../src/utils/luhn-code.js';

const CODE_LENGTH = 12;
const CODE_PREFIX = 'R';

export function isValidRedemptionCodeLuhn(code: string) {
  return isValidLuhnCode(code, {
    prefix: CODE_PREFIX,
    codeLength: CODE_LENGTH,
  });
}

export function assertRedeem(data: unknown) {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('order_id', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('code', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('source', expect.stringMatching(/^(ORDER|CDKEY)$/));
  expect(data).toHaveProperty('session_id', expect.any(String));
  expect(data).toHaveProperty('status', expect.stringMatching(/^(UNREDEEMED|REDEEMED)$/));
  expect(data).toHaveProperty('quantity', expect.any(Number));
  expect(data).toHaveProperty('valid_from', expect.any(String));
  expect(data).toHaveProperty('valid_until', expect.any(String));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
  expect(data).toHaveProperty('order', expect.toBeOneOf([expect.any(Object), null]));
  expect(data).toHaveProperty('exhibition', expect.any(Object));
  expect(data).toHaveProperty('session', expect.any(Object));
  expect(data).toHaveProperty('items', expect.any(Array));
  expect(data).toHaveProperty('cdkey', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('redeemed_at', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('redeemed_by', expect.toBeOneOf([expect.any(String), null]));
  expect(data).not.toHaveProperty('id');

  const redeem = data as Redeem.RedemptionCode;
  if (redeem.redeemed_at !== null) {
    expect(redeem.redeemed_at).toEqual(expect.any(String));
    expect(redeem.redeemed_by).toEqual(expect.any(String));
  }

  if (redeem.source === 'CDKEY') {
    expect(redeem.cdkey).toEqual(expect.any(String));
  }

  if (redeem.source === 'ORDER') {
    expect(redeem.order).toHaveProperty('id', expect.any(String));
    expect(redeem.order).toHaveProperty('user_id', expect.any(String));
    expect(redeem.order).toHaveProperty('exhibit_id', expect.any(String));
    expect(redeem.order).toHaveProperty('session_id', expect.any(String));
    expect(redeem.order).toHaveProperty('total_amount', expect.any(Number));
    expect(redeem.order).toHaveProperty('status', expect.any(String));
  }

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
): Promise<Redeem.RedemptionCodeWithOrder> {
  const redemption = await getJSON<Redeem.RedemptionCode>(
    server,
    `/orders/${orderId}/redemption`,
    { token },
  );

  assertRedeem(redemption);
  expect(redemption.order).toBeTruthy();
  return redemption as Redeem.RedemptionCodeWithOrder;
}

export async function redeemCode(
  server: Server,
  exhibitionId: string,
  code: string,
  token: string,
) {
  return postJSON<Redeem.RedemptionCode>(
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

export async function getRedemptionByCode(
  server: Server,
  code: string,
  token: string,
): Promise<Redeem.RedemptionCode> {
  const redemption = await getJSON<Redeem.RedemptionCode>(
    server,
    `/redemptions/${code}`,
    { token },
  );

  assertRedeem(redemption);
  expect(redemption.order).toBeTruthy();
  return redemption;
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
