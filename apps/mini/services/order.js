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

/**
 * 取消订单（仅待支付可取消；重复取消 204 幂等）
 * @param {string} orderId
 * @see docs/api/order.md
 */
export function cancelOrder(orderId) {
  const oid = encodeURIComponent(orderId);
  return request.delete(`/orders/${oid}`);
}

/**
 * 当前用户订单列表（分页）
 * @param {{ status?: string; page?: number; limit?: number }} [params]
 * @returns {Promise<{ orders: object[]; total: number; page: number; limit: number }>}
 * @see docs/api/order.md
 */
export function listOrders(params = {}) {
  const q = {};
  if (params.status != null && params.status !== "") {
    q.status = params.status;
  }
  if (params.page != null) {
    q.page = params.page;
  }
  if (params.limit != null) {
    q.limit = params.limit;
  }
  return request.get("/orders", { params: q });
}

/**
 * 隐藏订单（用于“删除票券”）
 * @param {string} orderId
 * @see docs/api/order.md
 */
export function hideOrder(orderId) {
  const oid = encodeURIComponent(orderId);
  // luch-request 不提供 patch 方法时，使用 request(config) 指定 method
  return request.request({
    url: `/orders/${oid}/hide`,
    method: "PATCH",
  });
}
