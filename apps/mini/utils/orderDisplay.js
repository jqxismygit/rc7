import dayjs from "dayjs";
import request from "@/utils/request.js";
import { formatExhibitionDateRangeLine } from "@/utils/ticketEventDisplay.js";

/** 订单状态 → 票夹列表用 UI 状态（与 mock 票券样式对齐并扩展） */
export function orderStatusToUi(orderStatus) {
  const map = {
    PAID: "unused",
    PENDING_PAYMENT: "pending_payment",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    REFUNDED: "refunded",
  };
  return map[orderStatus] || orderStatus;
}

/**
 * 批量拉展览信息（按 exhibit_id 去重）
 * @param {string[]} exhibitIds
 * @returns {Promise<Record<string, object|null>>}
 */
export async function loadExhibitionsMap(exhibitIds) {
  const ids = [...new Set((exhibitIds || []).filter(Boolean))];
  const map = Object.create(null);
  await Promise.all(
    ids.map(async (eid) => {
      try {
        map[eid] = await request.get(`/exhibition/${encodeURIComponent(eid)}`);
      } catch (e) {
        map[eid] = null;
      }
    }),
  );
  return map;
}

/**
 * 将 OrderWithItems + 展览信息转为票夹列表行
 * @param {object} order
 * @param {object | null} exhibition
 */
export function buildTicketRowFromOrder(order, exhibition) {
  const items = order.items || [];
  const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
  const itemNames = items
    .map((it) =>
      String(
        it?.category_name || it?.ticket_category_name || it?.name || "",
      ).trim(),
    )
    .filter(Boolean);
  const uniqueNames = [...new Set(itemNames)];
  let ticketType = uniqueNames[0] || "门票";
  if (items.length === 1) {
    ticketType = `${uniqueNames[0] || "门票"} ×${items[0].quantity}`;
  } else if (items.length > 1) {
    ticketType = uniqueNames.length
      ? `${uniqueNames.join(" / ")} · 共 ${totalQty} 张`
      : `${items.length} 种票 · 共 ${totalQty} 张`;
  }

  const ev = exhibition;
  const eventName = ev?.name || "展览门票";
  const eventLocation = ev?.location || "—";
  let eventDate = "";
  if (ev) {
    eventDate = formatExhibitionDateRangeLine(ev);
    if (!eventDate && ev.start_date) {
      eventDate = dayjs(ev.start_date).format("YYYY.MM.DD");
    }
  }
  if (!eventDate) {
    eventDate = dayjs(order.created_at).format("YYYY-MM-DD HH:mm");
  }

  const cover = ev?.cover_url || ev?.cover_image || ev?.cover || "";

  return {
    id: order.id,
    orderId: order.id,
    orderStatus: order.status,
    eventId: order.exhibit_id,
    eventName,
    eventDate,
    eventLocation,
    eventCover: cover,
    ticketType,
    quantity: totalQty || 1,
    price: order.total_amount,
    status: orderStatusToUi(order.status),
    canRefund: false,
    isThird: false,
  };
}

/**
 * 票券详情页用的票对象（兼容原 mock 字段）
 * @param {object} order
 * @param {object | null} exhibition
 */
export function buildTicketDetailFromOrder(order, exhibition) {
  const row = buildTicketRowFromOrder(order, exhibition);
  const startTime = exhibition?.start_date
    ? dayjs(exhibition.start_date).format("YYYY-MM-DD HH:mm")
    : "";
  const startClock = exhibition?.start_date
    ? dayjs(exhibition.start_date).format("HH:mm")
    : "";
  const startDateText = exhibition?.start_date
    ? dayjs(exhibition.start_date).format("YYYY-MM-DD")
    : "";
  const lastEntryClock = (exhibition?.last_entry_time || "").slice(0, 5);
  const entryTimeRange =
    startDateText && startClock && lastEntryClock
      ? `${startDateText} ${startClock}-${lastEntryClock}`
      : "";
  return {
    ...row,
    eventStartTime: startTime || row.eventDate,
    eventEntryTimeRange: entryTimeRange,
    purchaseTime: dayjs(order.paid_at || order.created_at).format(
      "YYYY-MM-DD HH:mm",
    ),
    qrCode: "",
    paidAmount: order.total_amount,
    orderNo: order.id,
    refundAmount: order.total_amount,
  };
}
