export interface WechatPayTransaction {
  id: string;
  order_id: string;
  /** 微信支付商户订单号：order_id 去掉 - 后的字符串 */
  out_trade_no: string;
  /** 微信返回的预支付会话标识 */
  prepay_id: string | null;
  total_amount: number;
  openid: string;
  created_at: string;
  updated_at: string;
}

export interface WechatPayCallback {
  id: string;
  /** 微信回调通知唯一 ID */
  wechat_notification_id: string;
  /** 事件类型，如 TRANSACTION.SUCCESS */
  event_type: string;
  out_trade_no: string | null;
  transaction_id: string | null;
  trade_state: string | null;
  /** 完整原始通知内容（JSON） */
  raw_payload: unknown;
  processed_at: string | null;
  created_at: string;
}

export type RefundStatus =
  | 'REQUESTED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED';

export interface RefundRecord {
  out_refund_no: string;
  order_id: string;
  payment_method: 'WECHATPAY' | 'DAMAI' | 'MOP' | 'CTRIP';
  status: RefundStatus;
  order_amount: number;
  refund_amount: number;
  reason: string;
  error_message: string | null;
  out_trade_no: string;
  refund_id: string | null;
  refund_status: string | null;
  refund_channel: string | null;
  callback_refund_amount: number | null;
  succeeded_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 返回给小程序以发起支付的参数 */
export interface PaySignResult {
  timeStamp: string;
  nonceStr: string;
  /** prepay_id=xxx */
  package: string;
  signType: 'RSA';
  paySign: string;
}
