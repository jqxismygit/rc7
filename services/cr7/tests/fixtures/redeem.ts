import { addDays, format } from 'date-fns';
import { Server } from 'node:http';
import { Redeem } from '@cr7/types';
import { getJSON, postJSON } from '../lib/api.js';

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

export async function getOrderRedemption(
  server: Server,
  orderId: string,
  token: string,
) {
  return getJSON<Redeem.RedemptionCodeWithOrder>(
    server,
    `/orders/${orderId}/redemption`,
    { token },
  );
}

export async function redeemCode(
  server: Server,
  code: string,
  token: string,
) {
  return postJSON<Redeem.RedemptionCodeWithOrder>(
    server,
    '/redemptions/redeem',
    {
      token,
      body: { code },
    },
  );
}

export function toSessionDateLabel(value: string) {
  if (value === '今天') {
    return format(addDays(new Date(), 0), 'yyyy-MM-dd');
  }
  return value;
}
