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
    return [md, hours, loc].filter(Boolean).join("·");
  }

  const start = ev.start_date ? dayjs(ev.start_date).format("MM/DD") : "";
  const end = ev.end_date ? dayjs(ev.end_date).format("MM/DD") : "";
  const range =
    start && end ? `展期 ${start}-${end}` : start || end || "";
  const parts = [range, hours, loc].filter(Boolean);
  const base = parts.join("·");
  return base ? `${base}（今日无场次）` : "";
}

/** 购票页信息区第一行：展期，如 2026.05.01-12.31 */
export function formatExhibitionDateRangeLine(ev) {
  if (!ev?.start_date || !ev?.end_date) return "";
  const s = dayjs(ev.start_date);
  const e = dayjs(ev.end_date);
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
