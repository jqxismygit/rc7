
export function random_value<T>(values: T[]): T {
  const idx = Math.floor(Math.random() * values.length);
  return values[idx];
}

export function random_text(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
}

export function random_integer(max = 10, min = 0) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}