export type CdkeyStatus = 'UNUSED' | 'USED';

export interface CdkeyBatch {
  id: string;
  exhibition: {
    id: string;
    name: string;
  };
  name: string;
  ticket_category: {
    id: string;
    name: string;
    list_price: number;
  }
  redeem_quantity: number;
  quantity: number;
  used_count: number;
  redeem_valid_until: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Cdkey {
  id: string;
  batch_id: string;
  exhibition: {
    id: string;
    name: string;
  };
  ticket_category: {
    id: string;
    name: string;
    list_price: number;
  };
  code: string;
  status: CdkeyStatus;
  redeem_quantity: number;
  redeem_valid_until: string;
  redeemed_session: null | {
    id: string;
    session_date: string;
  };
  redeemed_by: null | {
    id: string;
    phone: string;
  };
  redeemed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCdkeyBatchResult {
  id: string;
}

export interface CdkeyBatchListResult {
  batches: CdkeyBatch[];
  total: number;
  page: number;
  limit: number;
}

export interface CdkeyListResult {
  codes: Cdkey[];
  total: number;
  page: number;
  limit: number;
}

export interface RedeemCdkeyResult {
  code: string;
}
