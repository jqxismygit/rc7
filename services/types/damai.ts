export type DamaiOrderSyncStatus = 'SUCCESS' | 'FAILED';

export interface DamaiOrderSyncRecord {
  id: string;
  damai_order_id: string | null;
  request_path: string;
  request_body: unknown;
  response_body: unknown | null;
  sync_status: DamaiOrderSyncStatus;
  order_id: string | null;
  user_id: string | null;
  created_at: string;
}
