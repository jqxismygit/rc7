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
