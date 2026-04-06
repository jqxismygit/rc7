export type MopOrderSyncStatus = 'SUCCESS' | 'FAILED';

export interface MopOrderSyncRecord {
  id: string;
  my_order_id: string | null;
  request_path: string;
  request_body: unknown;
  response_body: unknown | null;
  sync_status: MopOrderSyncStatus;
  order_id: string | null;
  created_at: string;
}
