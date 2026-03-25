export type OrderStatus =
  | 'PENDING_PAYMENT'   // 待支付
  | 'PAID'              // 已支付
  | 'REFUND_REQUESTED'  // 退款已受理
  | 'REFUND_PROCESSING' // 退款处理中
  | 'REFUNDED'          // 已退款
  | 'REFUND_FAILED'     // 退款失败
  | 'CANCELLED'         // 已取消
  | 'EXPIRED';          // 已过期

export interface Order {
  id: string;
  user_id: string;
  exhibit_id: string;
  session_id: string;
  current_refund_out_refund_no: string | null;
  status: OrderStatus;
  total_amount: number;
  expires_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  released_at: string | null;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  ticket_category_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

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
