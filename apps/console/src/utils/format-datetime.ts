/** 控制台统一日期时间展示：YYYY-MM-DD HH:mm（24 小时制，按本地时区） */
import dayjs from "dayjs";

const DISPLAY = "YYYY-MM-DD HH:mm";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 后端可能返回完整 ISO；也可能是 `HH:mm` / `HH:mm:ss` */
const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function looksLikeFullDateTime(s: string): boolean {
  return s.includes("T") || /^\d{4}-\d{2}-\d{2}[ T]\d/.test(s);
}

/**
 * 将 ISO / 常见日期时间串 / 纯日期 YYYY-MM-DD 格式化为 `YYYY-MM-DD HH:mm`
 */
export function formatDateTime(input: string | null | undefined): string {
  if (input == null || input === "") return "—";
  const s = input.trim();
  let d = dayjs(s);
  if (d.isValid()) {
    return d.format(DISPLAY);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    d = dayjs(`${m[1]}-${m[2]}-${m[3]}`);
    if (d.isValid()) {
      return d.format(DISPLAY);
    }
  }
  return s;
}

/**
 * 开场 / 闭场 / 最晚入场：
 * - `timePart` 若为完整 ISO 或日期时间串，直接按该时刻格式化为 `YYYY-MM-DD HH:mm`
 * - 若为纯时间，则与 `dateYmdOrIso`（可为 `YYYY-MM-DD` 或 ISO）解析出的**本地展期日**组合后再格式化
 */
export function formatSessionDateTime(
  dateYmdOrIso: string,
  timePart: string | null | undefined,
): string {
  if (!timePart?.trim()) return "—";
  const t = timePart.trim();

  if (looksLikeFullDateTime(t)) {
    const d = dayjs(t);
    if (d.isValid()) {
      return d.format(DISPLAY);
    }
  }

  const base = dayjs(dateYmdOrIso.trim());
  if (!base.isValid()) {
    return formatDateTime(t);
  }

  const ymd = base.format("YYYY-MM-DD");
  const m = TIME_ONLY.exec(t);
  if (m) {
    const hh = pad2(Number(m[1]));
    const mm = pad2(Number(m[2]));
    const ss = pad2(Number(m[3] ?? 0));
    let d = dayjs(`${ymd} ${hh}:${mm}:${ss}`);
    if (!d.isValid()) {
      d = dayjs(`${ymd}T${hh}:${mm}:${ss}`);
    }
    if (d.isValid()) {
      return d.format(DISPLAY);
    }
  }

  const combined = dayjs(`${ymd} ${t}`);
  if (combined.isValid()) {
    return combined.format(DISPLAY);
  }

  return formatDateTime(t) !== "—" ? formatDateTime(t) : `${ymd} ${t}`;
}
