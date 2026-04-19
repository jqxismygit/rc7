import { Server } from 'node:http';
import { getJSON, postJSON, putJSON } from '../lib/api.js';
import type { Exhibition, Xiecheng } from '@cr7/types';
import { expect } from 'vitest';
import {
  buildXieChengSign,
  encryptXieChengBody,
  decryptXieChengBody,
} from '@/libs/xiecheng.js';
import type { IConfig } from 'config';

export async function bindTicketXiechengOptionId(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  otaOptionId: string,
) {
  return putJSON<Exhibition.TicketCategory>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc`,
    {
      token,
      body: {
        ota_option_id: otaOptionId,
      },
    },
  );
}

export async function syncTicketPriceToXiecheng(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  payload: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  return postJSON<Xiecheng.XcSyncLog>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync/prices`,
    {
      token,
      body: payload,
    },
  );
}

export async function syncTicketInventoryToXiecheng(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  payload: {
    start_session_date: string;
    end_session_date: string;
    quantity?: number;
  },
) {
  return postJSON<Xiecheng.XcSyncLog>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync/inventory`,
    {
      token,
      body: payload,
    },
  );
}

export async function listTicketXiechengSyncLogs(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  serviceName?: Xiecheng.XcServiceName,
) {
  return getJSON<Xiecheng.XcSyncLog[]>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync/logs`,
    {
      token,
      query: serviceName ? { service_name: serviceName } : undefined,
    },
  );
}

export function buildCtripOrderNotification(
  config: IConfig['xiecheng'],
  serviceName: Xiecheng.XcOrderServiceName,
  body:
    | Xiecheng.XcCreatePreOrderBody
    | Xiecheng.XcQueryOrderBody
    | Xiecheng.XcCancelPreOrderBody
    | Xiecheng.XcPayPreOrderBody
    | Xiecheng.XcCancelOrderBody,
): Xiecheng.XcEncryptedOrderNotification {
  const { account_id: accountId, secret: signKey, aes_key, aes_iv } = config;
  const plainBody = JSON.stringify(body);

  const encryptedBody = encryptXieChengBody(plainBody, aes_key, aes_iv);

  const { sign, requestTime, version } = buildXieChengSign(
    encryptedBody, { accountId, serviceName, signKey }
  );

  return {
    header: { accountId, serviceName, requestTime, version, sign },
    body: encryptedBody,
  };
}

export async function sendCtripOrderCallback(
  server: Server,
  notification: Xiecheng.XcEncryptedOrderNotification,
): Promise<Xiecheng.XcEncryptedOrderResponse> {
  return postJSON<Xiecheng.XcEncryptedOrderResponse>(
    server,
    '/ota/ctrip/callback',
    { body: notification },
  );
}

export async function getCtripOrderSyncRecords(
  server: Server,
  token: string,
  cr7OrderId: string,
): Promise<Xiecheng.XcOrderSyncRecord[]> {
  return getJSON<Xiecheng.XcOrderSyncRecord[]>(
    server,
    `/ota/ctrip/orders/${cr7OrderId}`,
    { token },
  );
}

export async function listCtripOrderSyncRecords(
  server: Server,
  token: string,
  query?: {
    limit?: number;
    offset?: number;
    ota_order_id?: string;
  },
): Promise<Xiecheng.XcOrderSyncRecordListResult> {
  return getJSON<Xiecheng.XcOrderSyncRecordListResult>(
    server,
    '/ota/ctrip/orders',
    {
      token,
      query,
    },
  );
}

export function decryptCtripResponseBody<Body>(
  response: Xiecheng.XcEncryptedOrderResponse,
  aesKey: string,
  aesIv: string,
): Body {
  const plain = decryptXieChengBody(response.body!, aesKey, aesIv);
  return JSON.parse(plain) as Body;
}

export function assertCtripSuccessResponse(
  response: { header: Xiecheng.XcResponseHeader }
) {
  expect(response).toHaveProperty('header');
  expect(response.header).toHaveProperty('resultCode', '0000');
}

export function assertCtripFailureResponse(
  response: Xiecheng.XcEncryptedOrderResponse,
  expectedCode?: string,
) {
  expect(response).toHaveProperty('header');
  expect(response.header.resultCode).not.toEqual('0000');
  if (expectedCode) {
    expect(response.header.resultCode).toEqual(expectedCode);
  }
}
