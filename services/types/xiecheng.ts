export type XcServiceName = 'DatePriceModify' | 'DateInventoryModify';

export type XcOrderServiceName = 'CreatePreOrder' | 'QueryOrder';

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

export interface XcRequestHeader {
  accountId: string;
  serviceName: XcOrderServiceName;
  requestTime: string;
  version: string;
  sign: string;
}

export interface XcCreatePreOrderContact {
  name?: string;
  mobile?: string;
  intlCode?: string;
}

export interface XcCreatePreOrderItem {
  PLU: string;
  useStartDate: string;
  useEndDate: string;
  quantity: number;
  price: number;
}

export interface XcCreatePreOrderBody {
  sequenceId: string;
  otaOrderId: string;
  contacts: XcCreatePreOrderContact[];
  items: XcCreatePreOrderItem[];
}

export interface XcEncryptedOrderNotification {
  header: XcRequestHeader;
  body: string;
}

export interface XcResponseHeader {
  resultCode: string;
  resultMessage: string;
}

export interface XcCreatePreOrderResponseItem {
  PLU: string;
  inventorys: Array<{
    useDate: string;
    quantity: number;
  }>;
}

export interface XcCreatePreOrderSuccessBody {
  otaOrderId: string;
  supplierOrderId: string;
  items: XcCreatePreOrderResponseItem[];
}

export interface XcEncryptedOrderResponse extends Record<string, unknown> {
  header: XcResponseHeader;
  body?: string;
}

export type XcOrderSyncStatus = 'SUCCESS' | 'DUPLICATE_ORDER' | 'FAILED';

export interface XcOrderSyncRecord {
  id: string;
  service_name: XcOrderServiceName;
  ota_order_id: string;
  sequence_id: string;
  sync_status: XcOrderSyncStatus;
  phone: string | null;
  country_code: string | null;
  user_id: string | null;
  order_id: string | null;
  total_amount: number;
  request_header: XcRequestHeader;
  request_body: XcCreatePreOrderBody;
  created_at: string;
};

export interface XcQueryOrderBody {
  sequenceId: string;
  otaOrderId: string;
  supplierOrderId?: string;
}

export interface XcQueryOrderResponseItem {
  itemId: number;
  useStartDate: string;
  useEndDate: string;
  orderStatus: number;
  quantity: number;
  useQuantity: number;
  cancelQuantity: number;
  passengers: Array<{ passengerId: string; passengerStatus: number }>;
  vouchers: Array<{ voucherId: string; voucherStatus: number }>;
}

export interface XcQueryOrderSuccessBody {
  otaOrderId: string;
  supplierOrderId: string;
  items: XcQueryOrderResponseItem[];
}
