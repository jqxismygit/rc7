import { Server } from 'node:http';
import config from 'config';
import { buildDamaiSignature } from '@/libs/damai.js';
import { postJSON } from '../lib/api.js';

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
