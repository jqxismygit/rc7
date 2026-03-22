import request from "@/utils/request.js";

/** 购票页写入、订单确认页读取的场次/展示上下文（避免 URL 过长） */
export const ORDER_CONFIRM_CONTEXT_KEY = "order_confirm_context";

/**
 * 创建订单
 * @param {string} exhibitionId
 * @param {string} sessionId
 * @param {{ ticket_category_id: string; quantity: number }[]} items
 * @see docs/api/order.md
 */
export function createOrder(exhibitionId, sessionId, items) {
  const eid = encodeURIComponent(exhibitionId);
  const sid = encodeURIComponent(sessionId);
  return request.post(`/exhibition/${eid}/sessions/${sid}/orders`, { items });
}

/**
 * 订单详情（含订单项）
 * @param {string} orderId
 */
export function getOrderDetail(orderId) {
  const oid = encodeURIComponent(orderId);
  return request.get(`/orders/${oid}`);
}
