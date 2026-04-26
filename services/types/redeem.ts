import { type OrderSource } from "./order.js";
import { Exhibition } from "./index.js";

export type RedemptionStatus = "UNREDEEMED" | "REDEEMED";
export type RedemptionSource = "ORDER" | "CDKEY";

export interface RedemptionRow {
  order_id: string | null;
  code: string;
  exhibit_id: string;
  source: RedemptionSource;
  cdkey: string | null;
  session_id: string;
  status: RedemptionStatus;
  quantity: number; // 准入人数
  valid_from: string;
  valid_until: string;
  redeemed_at: string | null;
  redeemed_by: string | null; // 核销人 user_id，仅当 status = REDEEMED 时有值
  owner_user_id: string; // 当前持有者 user_id，转移后更新
  created_at: string;
  updated_at: string;
}

export interface RedemptionCodeWithOrder extends RedemptionRow {
  order: null | {
    id: string;
    user_id: string;
    source: OrderSource;
    exhibit_id: string;
    session_id: string;
    total_amount: number;
    status: string;
  };
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

export interface RedemptionCodeListResult {
  redemptions: RedemptionCodeWithOrder[];
  total: number;
  page: number;
  limit: number;
}

export interface RedemptionTransfer {
  id: string;
  code: string;
  exhibit_id: string;
  from_user_id: string;
  to_user_id: string;
  created_at: string;
}

export interface RedemptionTransferListResult {
  transfers: RedemptionTransfer[];
}
