import { addDays, format, subDays } from 'date-fns';

const RELATIVE_DATE_AFTER_RE = /^(\d+)天后$/;
const RELATIVE_DATE_BEFORE_RE = /^(\d+)天前$/;

export function Text2Date(dateText: string): Date {
  if (dateText === '今天') {
    return new Date();
  }

  const afterMatch = RELATIVE_DATE_AFTER_RE.exec(dateText);
  if (afterMatch) {
    return addDays(new Date(), Number(afterMatch[1]));
  }

  const beforeMatch = RELATIVE_DATE_BEFORE_RE.exec(dateText);
  if (beforeMatch) {
    return subDays(new Date(), Number(beforeMatch[1]));
  }

  throw new Error(`Unsupported relative session date: ${dateText}`);
}

export function toDateLabel(value: string): string {
  if (value === '今天'
    || RELATIVE_DATE_AFTER_RE.test(value)
    || RELATIVE_DATE_BEFORE_RE.test(value)
  ) {
    return format(Text2Date(value), 'yyyy-MM-dd');
  }

  return value;
}
