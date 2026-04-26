export const DEFAULT_CODE_LENGTH = 12;
export const DEFAULT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function toLuhnDigits(input: string, alphabet: string) {
  const digits: number[] = [];

  for (const char of input) {
    if (/^[0-9]$/.test(char)) {
      digits.push(Number(char));
      continue;
    }

    const index = alphabet.indexOf(char);
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

function buildLuhn2(payload: string, alphabet: string) {
  const checkDigit1 = calculateLuhnCheckDigit(toLuhnDigits(payload, alphabet));
  const checkDigit2 = calculateLuhnCheckDigit(toLuhnDigits(payload + String(checkDigit1), alphabet));
  return `${checkDigit1}${checkDigit2}`;
}

function randomBusinessPart(length: number, alphabet: string) {
  return Array.from({ length })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join('');
}

export function buildLuhnCode(input: {
  prefix: string;
  codeLength?: number;
  alphabet?: string;
}) {
  const codeLength = input.codeLength ?? DEFAULT_CODE_LENGTH;
  const alphabet = input.alphabet ?? DEFAULT_CODE_ALPHABET;
  const payload = `${input.prefix}${randomBusinessPart(codeLength - 3, alphabet)}`;
  return `${payload}${buildLuhn2(payload, alphabet)}`;
}

export function isValidLuhnCode(code: string, input: {
  prefix: string;
  codeLength?: number;
  alphabet?: string;
}) {
  const codeLength = input.codeLength ?? DEFAULT_CODE_LENGTH;
  const alphabet = input.alphabet ?? DEFAULT_CODE_ALPHABET;

  if (code.length !== codeLength || code.startsWith(input.prefix) === false) {
    return false;
  }

  const payloadLength = codeLength - 2;
  const payload = code.slice(0, payloadLength);
  return code.slice(payloadLength) === buildLuhn2(payload, alphabet);
}
