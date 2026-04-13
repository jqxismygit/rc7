import { Server } from 'node:http';
import config from 'config';
import { Damai } from '@cr7/types';
import { buildDamaiSignature } from '@/libs/damai.js';
import { getJSON, postJSON } from '../lib/api.js';

export interface DamaiSubmitOrderCommodityInfo {
  priceId: string;
  seatId?: string;
  subOrderId: string;
}

export interface DamaiSubmitOrderPriceInfo {
  priceId: string;
  num: number;
  price: number;
  type?: number;
}

export interface DamaiSubmitOrderUserInfo {
  userId: string;
  name?: string;
  mobile?: string;
}

export interface DamaiCreateOrderBody {
  daMaiOrderId: string;
  projectId: string;
  performId: string;
  hasSeat: boolean;
  commodityInfoList: DamaiSubmitOrderCommodityInfo[];
  priceInfo: DamaiSubmitOrderPriceInfo[];
  userInfo: DamaiSubmitOrderUserInfo;
  totalAmountFen: number;
  realAmountOfFen: number;
  expressFee?: number;
}

export interface DamaiCreateOrderRequest {
  head: {
    version: string;
    msgId: string;
    apiKey: string;
    apiSecret: string;
    timestamp: string;
    signed: string;
  };
  bodySubmitOrder: {
    orderInfo: DamaiCreateOrderBody;
  };
}

export interface DamaiCreateOrderResponse {
  head: {
    returnCode: string;
    returnDesc: string;
  };
  body: {
    orderInfo: {
      orderId: string;
      totalAmount: number;
      realAmount: number;
      expressFee?: number;
    };
  };
}

export interface DamaiPayOrderBody {
  daMaiOrderId: string;
}

export interface DamaiPayOrderRequest {
  head: {
    version: string;
    msgId: string;
    apiKey: string;
    apiSecret: string;
    timestamp: string;
    signed: string;
  };
  bodyPayCallBack: {
    orderInfo: DamaiPayOrderBody;
  };
}

export interface DamaiPayOrderResponse {
  head: {
    returnCode: string;
    returnDesc: string;
  };
  body: {
    orderInfo: {
      orderId?: string;
      daMaiOrderId?: string;
      payStatus?: number;
    };
  };
}

export interface DamaiCancelOrderBody {
  orderId: string;
}

export interface DamaiCancelOrderRequest {
  head: {
    version: string;
    msgId: string;
    apiKey: string;
    apiSecret: string;
    timestamp: string;
    signed: string;
  };
  cancelOrderInfo: DamaiCancelOrderBody;
}

export interface DamaiCancelOrderResponse {
  head: {
    returnCode: string;
    returnDesc: string;
  };
}

export interface DamaiGetETicketInfoBody {
  daMaiUserId?: string;
  orderId: string;
}

export interface DamaiGetETicketInfoRequest {
  head: {
    version: string;
    msgId: string;
    apiKey: string;
    apiSecret: string;
    timestamp: string;
    signed: string;
  };
  bodyGetESeatInfo: DamaiGetETicketInfoBody;
}

export interface DamaiETicketInfo {
  aoDetailId: string;
  certType: number;
  hasSeat: boolean;
  price: number;
  priceId: string;
  qrcodeType: number;
  qrCode: string;
  exchangeCode: string;
  seatByNumber: boolean;
}

export interface DamaiGetETicketInfoResponse {
  head: {
    returnCode: string;
    returnDesc: string;
  };
  body: {
    bodyGetESeatInfo: {
      projectName?: string;
      showTime?: number;
      venueName?: string;
      eticketInfos: DamaiETicketInfo[];
    };
  };
}

export async function syncExhibitionToDamai(
  server: Server,
  token: string,
  eid: string,
) {
  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/damai/sync`,
    { token },
  );
}

export async function syncSessionsToDamai(
  server: Server,
  token: string,
  eid: string,
  range?: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  const body = range ? { ...range } : undefined;

  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/damai/sync/sessions`,
    { token, body },
  );
}

export async function syncTicketsToDamai(
  server: Server,
  token: string,
  eid: string,
  sid: string,
) {
  return postJSON<void>(
    server,
    `/exhibition/${eid}/sessions/${sid}/ota/damai/sync/tickets`,
    { token },
  );
}

export function buildDamaiCreateOrderRequest(orderInfo: DamaiCreateOrderBody): DamaiCreateOrderRequest {
  const signature = buildDamaiSignature({
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
  });

  return {
    head: {
      version: signature.version,
      msgId: signature.msgId,
      apiKey: signature.apiKey,
      apiSecret: signature.apiSecret,
      timestamp: signature.timestamp,
      signed: signature.signed,
    },
    bodySubmitOrder: {
      orderInfo,
    },
  };
}

export function buildDamaiPayOrderRequest(orderInfo: DamaiPayOrderBody): DamaiPayOrderRequest {
  const signature = buildDamaiSignature({
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
  });

  return {
    head: {
      version: signature.version,
      msgId: signature.msgId,
      apiKey: signature.apiKey,
      apiSecret: signature.apiSecret,
      timestamp: signature.timestamp,
      signed: signature.signed,
    },
    bodyPayCallBack: {
      orderInfo,
    },
  };
}

export function buildDamaiGetETicketInfoRequest(orderInfo: DamaiGetETicketInfoBody): DamaiGetETicketInfoRequest {
  const signature = buildDamaiSignature({
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
  });

  return {
    head: {
      version: signature.version,
      msgId: signature.msgId,
      apiKey: signature.apiKey,
      apiSecret: signature.apiSecret,
      timestamp: signature.timestamp,
      signed: signature.signed,
    },
    bodyGetESeatInfo: orderInfo,
  };
}

export function buildDamaiCancelOrderRequest(orderInfo: DamaiCancelOrderBody): DamaiCancelOrderRequest {
  const signature = buildDamaiSignature({
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
  });

  return {
    head: {
      version: signature.version,
      msgId: signature.msgId,
      apiKey: signature.apiKey,
      apiSecret: signature.apiSecret,
      timestamp: signature.timestamp,
      signed: signature.signed,
    },
    cancelOrderInfo: orderInfo,
  };
}

export async function syncDamaiOrderToCr7(
  server: Server,
  body: DamaiCreateOrderRequest,
) {
  return postJSON<DamaiCreateOrderResponse>(
    server,
    '/ota/damai/createOrder',
    { body },
  );
}

export async function syncDamaiPayOrderToCr7(
  server: Server,
  body: DamaiPayOrderRequest,
) {
  return postJSON<DamaiPayOrderResponse>(
    server,
    '/ota/damai/payCallBack',
    { body },
  );
}

export async function syncDamaiGetETicketInfoToCr7(
  server: Server,
  body: DamaiGetETicketInfoRequest,
) {
  return postJSON<DamaiGetETicketInfoResponse>(
    server,
    '/ota/damai/getSeatInfo',
    { body },
  );
}

export async function syncDamaiCancelOrderToCr7(
  server: Server,
  body: DamaiCancelOrderRequest,
) {
  return postJSON<DamaiCancelOrderResponse>(
    server,
    '/ota/damai/cancelOrder',
    { body },
  );
}

export interface DamaiRefundCallBackBody {
  daMaiOrderId: string;
  orderId: string;
  refundId: string;
  refundReason: string;
  refundAmountFen: number;
}

export interface DamaiRefundApplyRequest {
  head: {
    version: string;
    msgId: string;
    apiKey: string;
    apiSecret: string;
    timestamp: string;
    signed: string;
  };
  bodyRefundApply: {
    refundInfo: DamaiRefundCallBackBody;
  };
}

export interface DamaiRefundApplyResponse {
  head: {
    returnCode: string;
    returnDesc: string;
  };
}

export function buildDamaiRefundApplyRequest(
  refundInfo: DamaiRefundCallBackBody,
): DamaiRefundApplyRequest {
  const signature = buildDamaiSignature({
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
  });

  return {
    head: {
      version: signature.version,
      msgId: signature.msgId,
      apiKey: signature.apiKey,
      apiSecret: signature.apiSecret,
      timestamp: signature.timestamp,
      signed: signature.signed,
    },
    bodyRefundApply: {
      refundInfo,
    },
  };
}

export async function syncDamaiRefundApplyToCr7(
  server: Server,
  body: DamaiRefundApplyRequest,
) {
  return postJSON<DamaiRefundApplyResponse>(
    server,
    '/ota/damai/refundApply',
    { body },
  );
}

export async function getDamaiOrderSyncRecords(
  server: Server,
  token: string,
  cr7OrderId: string,
): Promise<Damai.DamaiOrderSyncRecord[]> {
  return getJSON<Damai.DamaiOrderSyncRecord[]>(
    server,
    `/ota/damai/orders/${cr7OrderId}`,
    { token },
  );
}
