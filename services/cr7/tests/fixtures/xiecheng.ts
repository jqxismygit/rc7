import { Server } from 'node:http';
import { getJSON, postJSON, putJSON } from '../lib/api.js';
import type { Exhibition, Xiecheng } from '@cr7/types';
import { expect } from 'vitest';
import {
  buildXieChengSign,
  encryptXieChengBody,
  decryptXieChengBody,
} from '@/libs/xiecheng.js';

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
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync`,
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

export interface CtripOrderNotificationOptions {
  accountId: string;
  signKey: string;
  aesKey: string;
  aesIv: string;
  serviceName?: Xiecheng.XcOrderServiceName;
  body: Xiecheng.XcCreatePreOrderBody;
  /** Optionally tamper with body to test failure scenarios */
  tamperBody?: boolean;
}

export function buildCtripOrderNotification(
  options: CtripOrderNotificationOptions,
): Xiecheng.XcEncryptedOrderNotification {
  const serviceName = options.serviceName ?? 'CreatePreOrder';
  const plainBody = JSON.stringify(options.body);

  let encryptedBody: string;
  if (options.tamperBody) {
    encryptedBody = 'tampered_body_string_that_cannot_be_decrypted';
  } else {
    encryptedBody = encryptXieChengBody(plainBody, options.aesKey, options.aesIv);
  }

  const { sign, requestTime, version } = buildXieChengSign(encryptedBody, {
    accountId: options.accountId,
    serviceName,
    signKey: options.signKey,
  });

  return {
    header: {
      accountId: options.accountId,
      serviceName,
      requestTime,
      version,
      sign,
    },
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
  rid: string,
): Promise<Xiecheng.XcOrderSyncRecord[]> {
  return getJSON<Xiecheng.XcOrderSyncRecord[]>(
    server,
    `/ota/ctrip/orders/${rid}`,
    { token },
  );
}

export function decryptCtripResponseBody(
  response: Xiecheng.XcEncryptedOrderResponse,
  aesKey: string,
  aesIv: string,
): Xiecheng.XcCreatePreOrderSuccessBody | null {
  if (!response.body) return null;
  const plain = decryptXieChengBody(response.body, aesKey, aesIv);
  return JSON.parse(plain) as Xiecheng.XcCreatePreOrderSuccessBody;
}

export function assertCtripSuccessResponse(response: Xiecheng.XcEncryptedOrderResponse) {
  expect(response).toHaveProperty('header');
  expect(response.header).toHaveProperty('resultCode', '0000');
}

export function assertCtripFailureResponse(
  response: Xiecheng.XcEncryptedOrderResponse,
  expectedCode?: string,
) {
  expect(response).toHaveProperty('header');
  expect(response.header.resultCode).not.toBe('0000');
  if (expectedCode) {
    expect(response.header.resultCode).toBe(expectedCode);
  }
}
