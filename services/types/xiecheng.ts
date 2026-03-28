export type XcServiceName = 'DatePriceModify' | 'DateInventoryModify';

export type XcSyncStatus = 'SUCCESS' | 'FAILURE';

export interface XcPriceSyncItem {
  date: string;
  sale_price: number;
  cost_price: number;
}

export interface XcInventorySyncItem {
  date: string;
  quantity: number;
}

export type XcSyncItem = XcPriceSyncItem | XcInventorySyncItem;

export interface XcSyncLog {
  sequence_id: string;
  ticket_category_id: string;
  service_name: XcServiceName;
  ota_option_id: string;
  sync_items: XcSyncItem[];
  sync_response: unknown;
  status: XcSyncStatus;
  created_at: Date;
}
