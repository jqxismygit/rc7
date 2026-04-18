/**
 * 退票确认弹窗：副标题与可选原因（展示文案与提交给后端的 reason 字段）
 * @see docs/api/payment.md — POST /orders/:oid/refund body: { reason?: string }
 */
export const REFUND_CONFIRM_TITLE = "申请退票";

export const REFUND_CONFIRM_SUBTITLE = "退票后不可恢复，请选择退票原因";

/** @type {{ label: string; value: string }[]} */
export const REFUND_REASON_OPTIONS = [
  { label: "天气原因", value: "天气原因" },
  { label: "行程有变", value: "行程有变" },
  { label: "票券买多了", value: "票券买多了" },
  { label: "暂时不想要了", value: "暂时不想要了" },
  { label: "其他", value: "其他" },
];
