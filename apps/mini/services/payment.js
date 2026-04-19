import request from "@/utils/request.js";

/**
 * 发起微信支付（获取小程序调起支付参数）
 * @param {string} orderId
 * @returns {Promise<{ timeStamp: string; nonceStr: string; package: string; signType: string; paySign: string }>}
 * @see docs/api/payment.md
 */
export function initiateWechatPay(orderId) {
  const oid = encodeURIComponent(orderId);
  return request.post(`/orders/${oid}/wechatpay`, {});
}

/**
 * 发起微信退款
 * @param {string} orderId
 * @param {{ reason?: string }} [options]
 * @returns {Promise<object>}
 * @see docs/api/payment.md
 */
export function initiateRefund(orderId, options = {}) {
  const oid = encodeURIComponent(orderId);
  const body = {};
  if (options.reason != null && String(options.reason).trim() !== "") {
    body.reason = String(options.reason).trim();
  }
  return request.post(`/orders/${oid}/refund`, body);
}
