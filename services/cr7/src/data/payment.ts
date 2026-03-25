import { Pool, PoolClient } from 'pg';
import { parseISO, subDays } from 'date-fns';
import type { Payment } from '@cr7/types';
import { getOrderStatusCase } from './order.js';

type DBClient = Pool | PoolClient;

export type PAYMENT_DATA_ERROR_CODES =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_STATUS_INVALID'
  | 'ORDER_EXPIRED'
  | 'USER_NO_OPENID'
  | 'ORDER_ALREADY_REDEEMED'
  | 'ORDER_NOT_REFUNDABLE'
  | 'ORDER_CONTAINS_NON_REFUNDABLE_ITEMS'
  | 'ORDER_REFUND_DEADLINE_PASSED'
  | 'REFUND_ALREADY_REQUESTED'
  | 'REFUND_PROCESSING'
  | 'ORDER_ALREADY_REFUNDED'
  | 'REFUND_RECORD_NOT_FOUND';

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
      ${getOrderStatusCase(schema, 'o.id')} AS status,
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
    if (row.status === 'EXPIRED') {
      throw new PaymentDataError('Order expired', 'ORDER_EXPIRED');
    }
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

type UpdateWechatPayCallbackFieldsInput = {
  out_trade_no: string | null;
  transaction_id: string | null;
  trade_state: string | null;
};

type CreateWechatRefundCallbackInput = {
  notification_id: string;
  event_type: string;
  out_trade_no: string | null;
  out_refund_no: string | null;
  refund_status: string | null;
  raw_payload: unknown;
};

type UpdateWechatRefundCallbackFieldsInput = {
  out_trade_no: string | null;
  out_refund_no: string | null;
  refund_status: string | null;
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

export async function updateWechatPayCallbackFields(
  client: DBClient,
  schema: string,
  wechatNotificationId: string,
  input: UpdateWechatPayCallbackFieldsInput,
): Promise<void> {
  await client.query(
    `UPDATE ${schema}.wechat_pay_callbacks
    SET
      out_trade_no = $2,
      transaction_id = $3,
      trade_state = $4
    WHERE wechat_notification_id = $1`,
    [
      wechatNotificationId,
      input.out_trade_no,
      input.transaction_id,
      input.trade_state,
    ],
  );
}

export async function createWechatRefundCallback(
  client: DBClient,
  schema: string,
  input: CreateWechatRefundCallbackInput,
): Promise<void> {
  await client.query(
    `INSERT INTO ${schema}.wechat_refund_callbacks (
      notification_id,
      event_type,
      out_trade_no,
      out_refund_no,
      refund_status,
      raw_payload,
      processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
    [
      input.notification_id,
      input.event_type,
      input.out_trade_no,
      input.out_refund_no,
      input.refund_status,
      input.raw_payload,
    ],
  );
}

export async function updateWechatRefundCallbackFields(
  client: DBClient,
  schema: string,
  notificationId: string,
  input: UpdateWechatRefundCallbackFieldsInput,
): Promise<void> {
  await client.query(
    `UPDATE ${schema}.wechat_refund_callbacks
    SET
      out_trade_no = $2,
      out_refund_no = $3,
      refund_status = $4
    WHERE notification_id = $1`,
    [
      notificationId,
      input.out_trade_no,
      input.out_refund_no,
      input.refund_status,
    ],
  );
}

export async function markWechatRefundCallbackProcessed(
  client: DBClient,
  schema: string,
  notificationId: string,
): Promise<void> {
  await client.query(
    `UPDATE ${schema}.wechat_refund_callbacks
    SET processed_at = COALESCE(processed_at, NOW())
    WHERE notification_id = $1`,
    [notificationId],
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

type OrderRefundInfo = {
  order_id: string;
  user_id: string;
  session_id: string;
  total_amount: number;
  session_date: string;
  out_trade_no: string | null;
  status: string;
  redemption_status: string | null;
};

type CreateRefundRecordInput = {
  out_refund_no: string;
  order_id: string;
  out_trade_no: string;
  order_amount: number;
  refund_amount: number;
  reason: string;
};

type RefundCallbackUpdateInput = {
  refund_status: string;
  refund_id?: string | null;
  refund_channel?: string | null;
  callback_refund_amount?: number | null;
  error_message?: string | null;
  succeeded_at?: string | null;
  failed_at?: Date | null;
};

export async function getOrderRefundInfo(
  client: DBClient,
  schema: string,
  orderId: string,
  userId: string,
): Promise<OrderRefundInfo> {
  const { rows } = await client.query<OrderRefundInfo>(
    `SELECT
      o.id AS order_id,
      o.user_id,
      o.session_id,
      o.total_amount,
      es.session_date::text AS session_date,
      tx.out_trade_no,
      ${getOrderStatusCase(schema, 'o.id')} AS status,
      rc.status AS redemption_status
    FROM ${schema}.exhibit_orders o
    JOIN ${schema}.exhibit_sessions es ON es.id = o.session_id
    LEFT JOIN LATERAL (
      SELECT t.out_trade_no
      FROM ${schema}.wechat_pay_transactions t
      WHERE t.order_id = o.id
      ORDER BY t.created_at DESC
      LIMIT 1
    ) tx ON TRUE
    LEFT JOIN ${schema}.exhibit_redemption_codes rc ON rc.order_id = o.id
    WHERE o.id = $1
      AND o.user_id = $2
    LIMIT 1`,
    [orderId, userId],
  );

  if (rows.length === 0) {
    throw new PaymentDataError('Order not found', 'ORDER_NOT_FOUND');
  }

  return rows[0];
}

export function assertOrderRefundableByStatus(order: OrderRefundInfo): void {
  if (order.status === 'REFUND_REQUESTED') {
    throw new PaymentDataError('Refund already requested', 'REFUND_ALREADY_REQUESTED');
  }

  if (order.status === 'REFUND_PROCESSING') {
    throw new PaymentDataError('Refund processing', 'REFUND_PROCESSING');
  }

  if (order.status === 'REFUNDED') {
    throw new PaymentDataError('Order already refunded', 'ORDER_ALREADY_REFUNDED');
  }

  if (order.status !== 'PAID' && order.status !== 'REFUND_FAILED') {
    throw new PaymentDataError('Order status invalid for refund', 'ORDER_STATUS_INVALID');
  }

  if (order.redemption_status === 'REDEEMED') {
    throw new PaymentDataError('Order already redeemed', 'ORDER_ALREADY_REDEEMED');
  }
}

export function assertOrderRefundableByPolicies(
  policies: Array<{ refund_policy: 'NON_REFUNDABLE' | 'REFUNDABLE_48H_BEFORE' }>,
  sessionDateText: string,
  now: Date,
): void {
  const hasNonRefundable = policies.some(p => p.refund_policy === 'NON_REFUNDABLE');
  const hasRefundable = policies.some(p => p.refund_policy === 'REFUNDABLE_48H_BEFORE');

  if (hasNonRefundable && hasRefundable) {
    throw new PaymentDataError(
      'Order contains non-refundable ticket categories',
      'ORDER_CONTAINS_NON_REFUNDABLE_ITEMS',
    );
  }

  if (hasNonRefundable) {
    throw new PaymentDataError('Order is not refundable', 'ORDER_NOT_REFUNDABLE');
  }

  if (hasRefundable) {
    const deadline = subDays(parseISO(sessionDateText), 2);
    if (now.getTime() >= deadline.getTime()) {
      throw new PaymentDataError('Refund deadline passed', 'ORDER_REFUND_DEADLINE_PASSED');
    }
  }
}

export async function createRefundRecord(
  client: DBClient,
  schema: string,
  input: CreateRefundRecordInput,
): Promise<Payment.RefundRecord> {
  const { rows } = await client.query<Payment.RefundRecord>(
    `INSERT INTO ${schema}.order_refunds (
      out_refund_no,
      order_id,
      payment_method,
      status,
      order_amount,
      refund_amount,
      reason,
      error_message,
      out_trade_no
    )
    VALUES ($1, $2, 'WECHATPAY', 'REQUESTED', $3, $4, $5, NULL, $6)
    RETURNING
      out_refund_no,
      order_id,
      payment_method,
      status,
      order_amount,
      refund_amount,
      reason,
      error_message,
      out_trade_no,
      refund_id,
      refund_status,
      refund_channel,
      callback_refund_amount,
      succeeded_at,
      failed_at,
      created_at,
      updated_at`,
    [
      input.out_refund_no,
      input.order_id,
      input.order_amount,
      input.refund_amount,
      input.reason,
      input.out_trade_no,
    ],
  );

  return rows[0];
}

export async function updateRefundRecordFromApplyResponse(
  client: DBClient,
  schema: string,
  outRefundNo: string,
  input: {
    refund_id?: string | null;
    refund_status?: string | null;
    refund_channel?: string | null;
    callback_refund_amount?: number | null;
  },
): Promise<void> {
  await client.query(
    `UPDATE ${schema}.order_refunds
    SET
      refund_id = COALESCE($2, refund_id),
      refund_status = COALESCE($3, refund_status),
      refund_channel = COALESCE($4, refund_channel),
      callback_refund_amount = COALESCE($5, callback_refund_amount),
      updated_at = NOW()
    WHERE out_refund_no = $1`,
    [
      outRefundNo,
      input.refund_id ?? null,
      input.refund_status ?? null,
      input.refund_channel ?? null,
      input.callback_refund_amount ?? null,
    ],
  );
}

export async function getCurrentRefundRecordByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<Payment.RefundRecord> {
  const { rows } = await client.query<Payment.RefundRecord>(
    `SELECT
      r.out_refund_no,
      r.order_id,
      r.payment_method,
      r.status,
      r.order_amount,
      r.refund_amount,
      r.reason,
      r.error_message,
      r.out_trade_no,
      r.refund_id,
      r.refund_status,
      r.refund_channel,
      r.callback_refund_amount,
      r.succeeded_at,
      r.failed_at,
      r.created_at,
      r.updated_at
    FROM ${schema}.exhibit_orders o
    JOIN ${schema}.order_refunds r
      ON r.out_refund_no = o.current_refund_out_refund_no
    WHERE o.id = $1
    LIMIT 1`,
    [orderId],
  );

  if (rows.length === 0) {
    throw new PaymentDataError('Refund record not found', 'REFUND_RECORD_NOT_FOUND');
  }

  return rows[0];
}

export async function listRefundRecordsByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<Payment.RefundRecord[]> {
  const { rows } = await client.query<Payment.RefundRecord>(
    `SELECT
      out_refund_no,
      order_id,
      payment_method,
      status,
      order_amount,
      refund_amount,
      reason,
      error_message,
      out_trade_no,
      refund_id,
      refund_status,
      refund_channel,
      callback_refund_amount,
      succeeded_at,
      failed_at,
      created_at,
      updated_at
    FROM ${schema}.order_refunds
    WHERE order_id = $1
    ORDER BY created_at DESC`,
    [orderId],
  );

  return rows;
}

export async function updateRefundRecordFromCallback(
  client: DBClient,
  schema: string,
  outRefundNo: string,
  input: RefundCallbackUpdateInput,
): Promise<{ order_id: string; status: Payment.RefundStatus } | null> {
  const { rows } = await client.query<{ order_id: string; status: Payment.RefundStatus }>(
    `UPDATE ${schema}.order_refunds
    SET
      status = CASE
        WHEN $2 = 'SUCCESS' THEN 'SUCCEEDED'
        WHEN $2 = 'PROCESSING' THEN 'PROCESSING'
        ELSE 'FAILED'
      END,
      refund_id = COALESCE($3, refund_id),
      refund_status = COALESCE($2, refund_status),
      refund_channel = COALESCE($4, refund_channel),
      callback_refund_amount = COALESCE($5, callback_refund_amount),
      error_message = COALESCE($6, error_message),
      succeeded_at = CASE
        WHEN $2 = 'SUCCESS' THEN COALESCE($7::timestamptz, NOW())
        ELSE succeeded_at
      END,
      failed_at = CASE
        WHEN $2 <> 'SUCCESS' THEN COALESCE($8::timestamptz, NOW())
        ELSE failed_at
      END,
      updated_at = NOW()
    WHERE out_refund_no = $1
    RETURNING
      order_id,
      status`,
    [
      outRefundNo,
      input.refund_status,
      input.refund_id ?? null,
      input.refund_channel ?? null,
      input.callback_refund_amount ?? null,
      input.error_message ?? null,
      input.succeeded_at ?? null,
      input.failed_at ?? null,
    ],
  );

  return rows[0] ?? null;
}
