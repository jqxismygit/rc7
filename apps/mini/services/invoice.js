import request from "@/utils/request.js";

/**
 * 申请订单发票
 * @param {string} orderId
 * @param {{ invoice_title: string; email: string; tax_no?: string }} payload
 * @returns {Promise<object>}
 * @see docs/api/invoices.md
 */
export function applyOrderInvoice(orderId, payload) {
  const oid = encodeURIComponent(orderId);
  return request.post(`/orders/${oid}/invoice`, payload);
}
