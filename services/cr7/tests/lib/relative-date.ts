import { addDays, format, subDays } from 'date-fns';

const RELATIVE_DATE_AFTER_RE = /^(\d+)天后$/;
const RELATIVE_DATE_BEFORE_RE = /^(\d+)天前$/;

export function toFutureDate(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
}

export function toDateFromRelativeText(relativeText: string): string {
  if (relativeText === '今天') {
    return format(new Date(), 'yyyy-MM-dd');
  }

  const afterMatch = RELATIVE_DATE_AFTER_RE.exec(relativeText);
  if (afterMatch) {
    return format(addDays(new Date(), Number(afterMatch[1])), 'yyyy-MM-dd');
  }

  const beforeMatch = RELATIVE_DATE_BEFORE_RE.exec(relativeText);
  if (beforeMatch) {
    return format(subDays(new Date(), Number(beforeMatch[1])), 'yyyy-MM-dd');
  }

  throw new Error(`Unsupported relative session date: ${relativeText}`);
}

export function toDateLabel(value: string): string {
  if (value === '今天' || RELATIVE_DATE_AFTER_RE.test(value) || RELATIVE_DATE_BEFORE_RE.test(value)) {
    return toDateFromRelativeText(value);
  }

  return value;
}
