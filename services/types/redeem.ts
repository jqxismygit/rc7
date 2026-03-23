export type RedemptionStatus = 'UNREDEEMED' | 'REDEEMED';

export interface RedemptionCode {
  order_id: string;
  code: string;
  exhibit_id: string;
  status: RedemptionStatus;
  quantity: number; // 准入人数
  valid_from: string; // ISO 8601 timestamp
  valid_until: string; // ISO 8601 timestamp
  redeemed_at: string | null;
  redeemed_by: string | null; // 核销人 user_id，仅当 status = REDEEMED 时有值
  created_at: string;
  updated_at: string;
}

export interface RedemptionCodeWithOrder extends RedemptionCode {
  order: {
    id: string;
    user_id: string;
    exhibit_id: string;
    session_id: string;
    total_amount: number;
    status: string;
  };
  items: Array<{
    id: string;
    ticket_category_id: string;
    quantity: number;
    unit_price: number;
    category_name: string;
  }>;
}

export interface RedeemRequest {
  code: string; // 核销码
  quantity?: number; // 本次核销人数，可选
}
