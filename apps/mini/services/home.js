// 首页相关 mock 服务
import {
  mockHomeCards,
  mockBrands,
  mockMessages,
  mockHeroBanners,
  mockHotTickets,
  mockHotEvents,
  mockHotWorldcup,
  mockCr7ZoneEntries,
  mockCr7News,
} from "@/utils/mockData.js";
import dayjs from "dayjs";
import request from "@/utils/request.js";

const MOCK_DELAY = 200;

const delay = (result) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(result), MOCK_DELAY);
  });

/**
 * 获取首页 Banner / 信息流卡片
 * 后续接真接口时，可直接改为 request.get('/cms/home/banners')
 */
export function fetchHomeCards() {
  const list = mockHomeCards.map((item) => ({ ...item }));
  return delay(list);
}

/**
 * 获取联名品牌列表
 * 对齐 PRD「联名品牌墙」
 */
export function fetchBrands() {
  const list = mockBrands.map((item) => ({ ...item }));
  return delay(list);
}

/**
 * 获取首页 Hero Banners
 */
export function fetchHeroBanners() {
  const list = mockHeroBanners.map((item) => ({ ...item }));
  return delay(list);
}

/**
 * 首页马上购票使用的展览 ID（与后台创建的展会一致；后续可改为配置/接口首条）
 * @see docs/api/exhibition.md、docs/api/inventory.md
 */
// const HOME_EXHIBITION_ID = "e0c47ea5-8b48-45b8-b52c-cc985871d6e4";
const HOME_EXHIBITION_ID = "061ea274-365f-4e4f-99c9-762fcc1972d9";

function sessionDateKey(session) {
  const raw = session?.session_date;
  if (!raw) return "";
  const text = String(raw).trim();
  if (!text) return "";
  // 纯日期不做时区换算，避免 YYYY-MM-DD 被解析后产生跨日偏移
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = dayjs(text);
  if (d.isValid()) return d.format("YYYY-MM-DD");
  return text.slice(0, 10);
}

/** 按当前本地日期匹配场次 session_date（YYYY-MM-DD） */
function findTodaySession(sessions) {
  const today = dayjs().format("YYYY-MM-DD");
  return sessions.find((s) => sessionDateKey(s) === today);
}

function refundHint(policy) {
  if (policy === "REFUNDABLE_48H_BEFORE") return "开场前 48 小时可退";
  return "不可退票";
}

/**
 * 展览 + 场次元信息：时间、地点等分字段存储，展示层再拼接（见 ticketEventDisplay.js）
 */
function buildTicketEvent(exhibition, todaySession) {
  const defaultCover = "/static/images/event-card.jpg";
  const cover =
    exhibition.cover_url ||
    exhibition.cover_image ||
    exhibition.cover ||
    defaultCover;

  return {
    id: exhibition.id,
    title: exhibition.name,
    cover,
    start_date: exhibition.start_date || "",
    end_date: exhibition.end_date || "",
    opening_time: exhibition.opening_time || "",
    closing_time: exhibition.closing_time || "",
    last_entry_time: exhibition.last_entry_time || "",
    location: exhibition.location || "",
    session_date: todaySession ? sessionDateKey(todaySession) : null,
    has_today_session: Boolean(todaySession),
    /** 接口暂无则空串，购票页用默认电话 */
    contact_phone: exhibition.contact_phone || "",
  };
}

function mapSessionInventoryToHomeTickets(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    originalPrice:
      row.name === "早鸟票" ? parseInt(row.price * 1.2) : row.price,
    description: `${refundHint(row.refund_policy)} · ${row.valid_duration_days} 天有效 · 可入场 ${row.admittance} 人`,
    stock: typeof row.quantity === "number" ? row.quantity : 0,
    canRefund: row.refund_policy === "REFUNDABLE_48H_BEFORE",
    // tag:
    //   typeof row.quantity === "number" && row.quantity > 0 && row.quantity < 20
    //     ? "限量"
    //     : "",
    tag: row.name === "早鸟票" ? "限量" : "",
  }));
}

function mapSessionOptions(rows) {
  return (rows || [])
    .map((row) => ({
      id: row?.id || "",
      date: sessionDateKey(row),
    }))
    .filter((row) => row.id && row.date);
}

export async function loadHomeTicketSection() {
  const eid = HOME_EXHIBITION_ID;

  const [exhibition, sessions] = await Promise.all([
    request.get(`/exhibition/${eid}`),
    request.get(`/exhibition/${eid}/sessions`),
  ]);

  const list = Array.isArray(sessions) ? sessions : [];
  const todaySession = findTodaySession(list);
  const ticketEvent = buildTicketEvent(exhibition, todaySession);
  const sessionOptions = mapSessionOptions(list);

  let ticketTypes = [];
  if (todaySession?.id) {
    const sid = encodeURIComponent(todaySession.id);
    const inv = await request.get(`/exhibition/${eid}/sessions/${sid}/tickets`);
    ticketTypes = mapSessionInventoryToHomeTickets(
      Array.isArray(inv) ? inv : [],
    );
  }

  return {
    ticketEvent,
    ticketTypes,
    sessions: sessionOptions,
    /** 当前用于加载票价的场次，创建订单时作为 :sid */
    sessionId: todaySession?.id || "",
  };
}

/**
 * 获取 CR7 News 列表
 */
export function fetchCr7News() {
  return delay(mockCr7News.map((item) => ({ ...item })));
}

/**
 * 获取首页热门活动数据
 */
export function fetchHotTickets() {
  return delay(mockHotTickets.map((item) => ({ ...item })));
}

export function fetchHotEvents() {
  return delay(mockHotEvents.map((item) => ({ ...item })));
}

export function fetchHotWorldcup() {
  return delay(mockHotWorldcup.map((item) => ({ ...item })));
}

export function fetchCr7Zone() {
  return delay(mockCr7ZoneEntries.map((item) => ({ ...item })));
}

/**
 * 获取首页消息红点数量
 * 这里复用消息 mock，方便 index 与 messages 逻辑统一
 */
export async function fetchHomeUnreadCount() {
  const unread = mockMessages.filter((item) => !item.isRead).length;
  return delay(unread);
}
