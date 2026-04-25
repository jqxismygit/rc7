import request from "@/utils/request.js";

/**
 * 查询订单核销信息
 * @param {string} orderId
 * @returns {Promise<object>}
 * @see docs/api/redeem.md
 */
export function getOrderRedemption(orderId) {
  const oid = encodeURIComponent(orderId);
  return request.get(`/orders/${oid}/redemption`);
}

/**
 * 执行核销
 * @param {string} exhibitId
 * @param {{ code: string; quantity?: number }} payload
 * @returns {Promise<object>}
 * @see docs/api/redeem.md
 */
export function redeemTicket(exhibitId, payload) {
  const eid = encodeURIComponent(exhibitId);
  return request.post(`/exhibition/${eid}/redeem`, payload);
}

/**
 * 三方票同步（转移核销码）
 * @param {{ code: string }} payload
 * @returns {Promise<void>}
 * @see docs/api/redeem.md
 */
export function transferRedemption(payload) {
  return request.post("/redemptions/transfer", payload);
}
