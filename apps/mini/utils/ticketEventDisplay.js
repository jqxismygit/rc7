import dayjs from "dayjs";

/** 首页卡片副标题：场次日 + 开闭馆 + 地点 */
export function formatTicketEventCardMetaLine(ev) {
  if (!ev) return "";
  const open = (ev.opening_time || "").slice(0, 5);
  const close = (ev.closing_time || "").slice(0, 5);
  const loc = ev.location || "";
  const hours = open && close ? `${open}-${close}` : "";

  if (ev.session_date) {
    const md = dayjs(ev.session_date).format("MM/DD");
    return [md, loc].filter(Boolean).join("·");
  }

  const start = ev.start_date ? dayjs(ev.start_date).format("MM/DD") : "";
  const end = ev.end_date ? dayjs(ev.end_date).format("MM/DD") : "";
  const range = start && end ? `展期 ${start}-${end}` : start || end || "";
  const parts = [range, hours, loc].filter(Boolean);
  const base = parts.join("·");
  return base ? `${base}（今日无场次）` : "";
}

/** 首页「马上购票」专用文案，避免与其他页面时间格式混用 */
export function formatHomeTicketEventCardLine(ev) {
  if (!ev) return "";
  const range = formatExhibitionDateRangeLine(ev);
  const legacyLine = formatTicketEventCardMetaLine(ev);
  const suffix = legacyLine.split("·").slice(1).join("·");
  return [range, suffix].filter(Boolean).join("·");
}

/** 购票页信息区第一行：展期，如 2026.05.01-12.31 */

export function formatExhibitionDateRangeLine(ev) {
  if (!ev?.start_date || !ev?.end_date) return "";
  const s = dayjs(ev.start_date);
  const e = dayjs(ev.end_date);
  if (!s.isValid() || !e.isValid()) return "";
  if (s.isSame(e, "day")) {
    return s.format("YYYY.MM.DD");
  }
  if (s.year() === e.year()) {
    return `${s.format("YYYY.MM.DD")}-${e.format("MM.DD")}`;
  }
  return `${s.format("YYYY.MM.DD")}-${e.format("YYYY.MM.DD")}`;
}

/** 购票页信息区第二行：开放时间与最晚入场 */
export function formatOpenHoursLine(ev) {
  if (!ev) return "";
  const open = (ev.opening_time || "").slice(0, 5);
  const close = (ev.closing_time || "").slice(0, 5);
  const last = (ev.last_entry_time || "").slice(0, 5);
  if (!open && !close) return "";
  const span = open && close ? `${open} - ${close}` : open || close;
  const lastPart = last ? `(最晚入场${last})` : "";
  return `${span} ${lastPart}`.trim();
}

function parseShanghai(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // 小程序端 dayjs 的 utcOffset 行为不稳定，这里手动换算到东八区，
  // 再交给 dayjs 做统一格式化。
  const shanghaiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const yyyy = shanghaiDate.getUTCFullYear();
  const mm = String(shanghaiDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shanghaiDate.getUTCDate()).padStart(2, "0");
  const hh = String(shanghaiDate.getUTCHours()).padStart(2, "0");
  const mi = String(shanghaiDate.getUTCMinutes()).padStart(2, "0");
  return dayjs(`${yyyy}-${mm}-${dd} ${hh}:${mi}`);
}

/** 核销码有效期：仅日期，如 2026.05.01-12.31（按 Asia/Shanghai 时区） */
export function formatRedemptionValidityDateRangeLine(validFrom, validUntil) {
  const start = parseShanghai(validFrom);
  const end = parseShanghai(validUntil);
  if (!start || !end) return "";
  if (start.isSame(end, "day")) {
    return start.format("YYYY.MM.DD");
  }
  if (start.year() === end.year()) {
    return `${start.format("YYYY.MM.DD")}-${end.format("MM.DD")}`;
  }
  return `${start.format("YYYY.MM.DD")}-${end.format("YYYY.MM.DD")}`;
}

/** 核销码有效期：日期+时间，如 2026.05.01 9:00-17:00（按 Asia/Shanghai 时区） */
export function formatRedemptionValidityDateTimeLine(validFrom, validUntil) {
  const start = parseShanghai(validFrom);
  const end = parseShanghai(validUntil);
  if (!start || !end) return "";
  const startDate = start.format("YYYY.MM.DD");
  if (start.isSame(end, "day")) {
    return `${startDate} ${start.format("H:mm")}-${end.format("H:mm")}`;
  }
  return `${startDate} ${start.format("H:mm")}-${end.format("YYYY.MM.DD H:mm")}`;
}
