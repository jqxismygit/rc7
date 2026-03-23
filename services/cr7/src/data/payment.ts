import { Pool, PoolClient } from 'pg';
import type { Payment } from '@cr7/types';
import { ORDER_STATUS_CASE } from './order.js';

type DBClient = Pool | PoolClient;

export type PAYMENT_DATA_ERROR_CODES =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_STATUS_INVALID'
  | 'USER_NO_OPENID';

export class PaymentDataError extends Error {
  code: PAYMENT_DATA_ERROR_CODES;

  constructor(message: string, code: PAYMENT_DATA_ERROR_CODES) {
    super(message);
    this.name = 'PaymentDataError';
    this.code = code;
  }
}

interface OrderPaymentInfo {
  order_id: string;
  user_id: string;
  /** 商品描述: {展会名} 展会 {票类名} {场次日期} 场次 */
  description: string;
  total_amount: number;
  openid: string;
  out_trade_no: string;
  status: string;
  created_at: string;
}

/**
 * 查询订单的支付相关信息（包含用户 openid、商品描述等）
 * 若订单不属于该用户或不存在，抛出 ORDER_NOT_FOUND。
 * 若订单状态非 PENDING_PAYMENT，抛出 ORDER_STATUS_INVALID。
 * 若用户无 openid，抛出 USER_NO_OPENID。
 */
export async function getOrderPaymentInfo(
  client: DBClient,
  schema: string,
  orderId: string,
  userId: string,
): Promise<OrderPaymentInfo> {
  const { rows } = await client.query<{
    order_id: string;
    user_id: string;
    description: string;
    total_amount: number;
    openid: string | null;
    out_trade_no: string;
    status: string;
    created_at: string;
  }>(
    `SELECT
      o.id AS order_id,
      o.user_id,
      e.name || ' 展会 ' || tc.name || ' ' || TO_CHAR(es.session_date, 'YYYY-MM-DD') || ' 场次' AS description,
      o.total_amount,
      uw.openid,
      REPLACE(o.id::text, '-', '') AS out_trade_no,
      ${ORDER_STATUS_CASE} AS status,
      o.created_at
    FROM ${schema}.exhibit_orders o
    JOIN ${schema}.exhibitions e ON o.exhibit_id = e.id
    JOIN ${schema}.exhibit_sessions es ON o.session_id = es.id
    JOIN ${schema}.exhibit_order_items oi ON oi.order_id = o.id
    JOIN ${schema}.exhibit_ticket_categories tc ON oi.ticket_category_id = tc.id
    LEFT JOIN ${schema}.user_wechat uw ON uw.uid = o.user_id
    WHERE o.id = $1
      AND o.user_id = $2
    LIMIT 1`,
    [orderId, userId],
  );

  if (rows.length === 0) {
    throw new PaymentDataError('Order not found', 'ORDER_NOT_FOUND');
  }

  const row = rows[0];

  if (row.status !== 'PENDING_PAYMENT') {
    throw new PaymentDataError('Order status invalid for payment', 'ORDER_STATUS_INVALID');
  }

  if (row.openid === null) {
    throw new PaymentDataError('User has no wechat openid', 'USER_NO_OPENID');
  }

  return {
    order_id: row.order_id,
    user_id: row.user_id,
    description: row.description,
    total_amount: row.total_amount,
    openid: row.openid,
    out_trade_no: row.out_trade_no,
    status: row.status,
    created_at: row.created_at,
  };
}

/**
 * 创建或获取已存在的微信支付交易记录（幂等）
 */
export async function upsertWechatPayTransaction(
  client: DBClient,
  schema: string,
  orderId: string,
  outTradeNo: string,
  totalAmount: number,
  openid: string,
): Promise<Payment.WechatPayTransaction> {
  const { rows } = await client.query<Payment.WechatPayTransaction>(
    `INSERT INTO ${schema}.wechat_pay_transactions (order_id, out_trade_no, total_amount, openid)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (out_trade_no) DO UPDATE SET
      updated_at = NOW()
    RETURNING
      id,
      order_id,
      out_trade_no,
      prepay_id,
      total_amount,
      openid,
      created_at,
      updated_at`,
    [orderId, outTradeNo, totalAmount, openid],
  );

  return rows[0];
}

/**
 * 更新微信支付交易记录的 prepay_id
 */
export async function updateWechatPayTransactionPrepayId(
  client: DBClient,
  schema: string,
  outTradeNo: string,
  prepayId: string,
): Promise<void> {
  await client.query(
    `UPDATE ${schema}.wechat_pay_transactions
    SET prepay_id = $2, updated_at = NOW()
    WHERE out_trade_no = $1`,
    [outTradeNo, prepayId],
  );
}

type CreateWechatPayCallbackInput = {
  wechat_notification_id: string;
  event_type: string;
  out_trade_no: string | null;
  transaction_id: string | null;
  trade_state: string | null;
  raw_payload: unknown;
};

export async function createWechatPayCallback(
  client: DBClient,
  schema: string,
  input: CreateWechatPayCallbackInput,
): Promise<void> {
  await client.query(
    `INSERT INTO ${schema}.wechat_pay_callbacks (
      wechat_notification_id,
      event_type,
      out_trade_no,
      transaction_id,
      trade_state,
      raw_payload,
      processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
    [
      input.wechat_notification_id,
      input.event_type,
      input.out_trade_no,
      input.transaction_id,
      input.trade_state,
      input.raw_payload,
    ],
  );
}

export async function markWechatPayCallbackProcessed(
  client: DBClient,
  schema: string,
  wechatNotificationId: string,
): Promise<void> {
  await client.query(
    `UPDATE ${schema}.wechat_pay_callbacks
    SET processed_at = COALESCE(processed_at, NOW())
    WHERE wechat_notification_id = $1`,
    [wechatNotificationId],
  );
}

/**
 * 根据 out_trade_no 将订单置为已支付。重复回调不会重复修改 paid_at（幂等）。
 */
export async function markOrderPaidByOutTradeNo(
  client: DBClient,
  schema: string,
  outTradeNo: string,
): Promise<string | null> {
  const { rows } = await client.query<{ order_id: string }>(
    `UPDATE ${schema}.exhibit_orders o
    SET
      paid_at = COALESCE(o.paid_at, NOW()),
      updated_at = NOW()
    FROM ${schema}.wechat_pay_transactions t
    WHERE t.out_trade_no = $1
      AND o.id = t.order_id
      AND o.cancelled_at IS NULL
    RETURNING o.id AS order_id`,
    [outTradeNo],
  );

  return rows[0]?.order_id ?? null;
}

export async function getOutTradeNoByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<{ out_trade_no: string; user_id: string } | null> {
  const { rows } = await client.query<{ out_trade_no: string; user_id: string }>(
    `SELECT
      t.out_trade_no,
      o.user_id
    FROM ${schema}.wechat_pay_transactions t
    JOIN ${schema}.exhibit_orders o ON o.id = t.order_id
    WHERE t.order_id = $1
    ORDER BY t.created_at DESC
    LIMIT 1`,
    [orderId],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}
