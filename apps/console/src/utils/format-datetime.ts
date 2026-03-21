/** 控制台统一日期时间展示：YYYY-MM-DD HH:mm（24 小时制，按本地时区） */

const pad2 = (n: number) => String(n).padStart(2, "0");

function toYMDHM(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 本地日历日期 YYYY-MM-DD（用于把 ISO 的 start_date 落到「展期那一天」） */
function toLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return toYMDHM(d);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const d2 = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    if (!Number.isNaN(d2.getTime())) {
      return toYMDHM(d2);
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
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      return toYMDHM(d);
    }
  }

  const base = new Date(dateYmdOrIso.trim());
  if (Number.isNaN(base.getTime())) {
    return formatDateTime(t);
  }

  const ymd = toLocalYmd(base);
  const m = TIME_ONLY.exec(t);
  if (m) {
    const hh = pad2(Number(m[1]));
    const mm = pad2(Number(m[2]));
    const ss = pad2(Number(m[3] ?? 0));
    const d = new Date(`${ymd}T${hh}:${mm}:${ss}`);
    if (!Number.isNaN(d.getTime())) {
      return toYMDHM(d);
    }
  }

  const combined = new Date(`${ymd} ${t}`);
  if (!Number.isNaN(combined.getTime())) {
    return toYMDHM(combined);
  }

  return formatDateTime(t) !== "—" ? formatDateTime(t) : `${ymd} ${t}`;
}
