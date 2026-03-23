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
