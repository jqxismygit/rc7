import { Exhibition, Invoice, Payment } from "./index.js";

type OrderRefundStatus =
  | 'REFUND_REQUESTED'  // 退款已受理
  | 'REFUND_PROCESSING' // 退款处理中
  | 'REFUNDED'          // 已退款
  | 'REFUND_FAILED';     // 退款失败

type OrderPaidFailedStatus =
  | 'CANCELLED'         // 已取消
  | 'EXPIRED';          // 已过期

export type OrderStatus =
  | 'PENDING_PAYMENT'   // 待支付
  | 'PAID'              // 已支付
  | OrderRefundStatus
  | OrderPaidFailedStatus;

export type OrderSource = 'DIRECT' | 'CTRIP' | 'MOP' | 'DAMAI';
export type OrderSessionHalf = 'AM' | 'PM';

export interface OrderRow {
  id: string;
  user_id: string;
  exhibit_id: string;
  session_id: string;
  session_half: OrderSessionHalf | null;
  session_date: string;
  current_refund_out_refund_no: string | null;
  status: OrderStatus;
  total_amount: number;
  expires_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  released_at: string | null;
  hidden_at: string | null;
  // DIRECT for CR7 native orders, CTRIP, MOP, DAMAI OTA callbacks.
  source: OrderSource;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  ticket_category_id: string;
  ticket_category_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

export interface OrderRefundInfo extends Pick<
  Payment.RefundRecord,
  'out_refund_no' | 'reason' | 'status'
> {}

export interface OrderInvoiceInfo extends Pick<
  Invoice.InvoiceRecord,
  'id' | 'invoice_title' | 'email' | 'status'
> {}

export interface OrderBase extends OrderRow {
  items: OrderItem[];
  exhibition: Pick<
    Exhibition.Exhibition,
    | "id"
    | "name"
    | "description"
    | "cover_url"
    | "location"
    | "city"
    | "venue_name"
    | "start_date"
    | "end_date"
  >;
  session: Pick<
    Exhibition.Exhibition,
    "opening_time" | "closing_time" | "last_entry_time"
  > & { id: string; session_date: string };
  invoice: null | OrderInvoiceInfo;
  refund: null | OrderRefundInfo;
}

interface OrderWithRefund extends OrderBase {
  status: OrderRefundStatus;
  refund: OrderRefundInfo;
}

export type OrderWithItems =
  | OrderBase
  | OrderWithRefund;

export interface OrderListResult {
  orders: OrderWithItems[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateOrderItem {
  ticket_category_id: string;
  quantity: number;
}
