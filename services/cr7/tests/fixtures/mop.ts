import { Server } from 'node:http';
import { postJSON } from '../lib/api.js';
import {
  buildMopRequest,
  buildMopResponseSign,
  decryptMopData,
  encryptMopData,
  parseMopResponseData,
  verifyMopSign,
} from '@/libs/mop.js';
import { format } from 'date-fns';
import config from 'config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { mockJSONServer } from '../lib/server.js';
import type { Mop } from '@cr7/types';
import { getJSON } from '../lib/api.js';

export interface SyncExhibitionToMoeResponse {
  success: true;
  request: {
    cityId: string;
    cityName: string;
    otProjectId: string;
    category: number;
    otVenueId: string;
    otVenueName: string;
    projectStatus: number;
    name: string;
  };
}

export interface SyncSessionsToMopRequest {
  otProjectId: string;
  shows: Array<{
    otShowId: string;
    otShowStatus: number;
    startTime: string;
    endTime: string;
    showType: number;
    fetchTicketWay: number[];
    maxBuyLimitPerOrder: number;
  }>;
}

export interface SyncTicketsToMopRequest {
  otProjectId: string;
  isOta: number;
  skus: Array<{
    otSkuId: string;
    otSkuStatus: number;
    name: string;
    skuPrice: string;
    sellPrice: string;
    onSaleTime: string;
    offSaleTime: string;
    inventoryType: number;
  }>;
}

export interface MopOrderCreateRequest {
  myOrderId: string;
  projectCode: string;
  projectShowCode: string;
  buyerName: string;
  buyerPhone: string;
  totalPrice: string;
  needSeat: boolean;
  needRealName: boolean;
  ticketInfo: Array<{
    myTicketId: string;
    skuId: string;
    ticketPrice: string;
  }>;
}

export interface MopOrderSyncResponseData {
  myOrderId: string;
  channelOrderId: string;
  payExpiredTime: string;
}

export interface MopOrderQueryRequest {
  myOrderId: string;
}

export interface MopOrderQueryResponseData {
  myOrderId: string;
  fetchCode: string | null;
  fetchQrCode: string | null;
  orderStatus: number;
  orderRefundStatus: number;
  orderConsumeStatus: number;
  ticketInfo: Array<{
    myTicketId: string;
    channelTicketId: string;
    ticketConsumeStatus: number;
    checkCode: string | null;
    checkQrCode: string | null;
  }>;
}

export interface MopEncryptedResponse {
  code: number;
  timestamp: string;
  msg: string;
  sign: string;
  encryptData: string | null;
}

export async function syncExhibitionToMop(
  server: Server,
  token: string,
  eid: string,
) {
  return postJSON<SyncExhibitionToMoeResponse>(
    server,
    `/exhibition/${eid}/ota/mop/sync`,
    { token },
  );
}

export async function syncSessionsToMop(
  server: Server,
  token: string,
  eid: string,
) {
  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/mop/sync/sessions`,
    { token },
  );
}

export async function syncTicketsToMop(
  server: Server,
  token: string,
  eid: string,
) {
  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/mop/sync/tickets`,
    { token },
  );
}

export async function syncMopOrderToCr7(
  server: Server,
  body: MopOrderCreateRequest,
) {
  const { mop } = config;
  const { supplier, aes_key: aesKey, private_key_path } = mop;
  const privateKey = await readFile(path.resolve(private_key_path), 'utf-8');

  const { headers, payload } = buildMopRequest(
    '/mop/order',
    { supplier, aesKey, privateKey, body }
  );

  return postJSON<MopEncryptedResponse>(
    server,
    '/mop/order',
    { headers: { ...headers }, body: payload },
  );
}

export async function queryMopOrderFromCr7(
  server: Server,
  body: MopOrderQueryRequest,
) {
  const { mop } = config;
  const { supplier, aes_key: aesKey, private_key_path } = mop;
  const privateKey = await readFile(path.resolve(private_key_path), 'utf-8');

  const { headers, payload } = buildMopRequest(
    '/mop/orderQuery',
    { supplier, aesKey, privateKey, body }
  );

  return postJSON<MopEncryptedResponse>(
    server,
    '/mop/orderQuery',
    { headers: { ...headers }, body: payload },
  );
}

export async function getMopOrderSyncRecords(
  server: Server,
  token: string,
  cr7OrderId: string,
): Promise<Mop.MopOrderSyncRecord[]> {
  return getJSON<Mop.MopOrderSyncRecord[]>(
    server,
    `/ota/mop/orders/${cr7OrderId}`,
    { token },
  );
}

export async function parseMopEncryptedResponse<T>(response: MopEncryptedResponse) {
  const { mop } = config;
  const { aes_key: aesKey, public_key_path } = mop;
  const publicKey = await readFile(path.resolve(public_key_path), 'utf-8');
  return parseMopResponseData<T>(response, { aesKey, publicKey });
}

export async function verifyMopResponseSign(uri: string, response: MopEncryptedResponse) {
  const { mop } = config;
  const { public_key_path, supplier } = mop;
  const publicKey = await readFile(path.resolve(public_key_path), 'utf-8');
  const { sign, ...options } = response;
  return verifyMopSign(sign, uri, { ...options, supplier, publicKey });
}

function buildMopResponse(
  code: number, msg: string, privateKey: string,
  aesKey: string,
  body: unknown = null
) {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const { sign } = buildMopResponseSign({ code, timestamp, privateKey });
  const encryptData = body === null ? null : encryptMopData(JSON.stringify(body), aesKey);

  return {
    code,
    msg,
    timestamp,
    sign,
    encryptData,
  };
}

export async function setupMopMockServer(
  mopRequestHandler: (
    request: { uri: string, body: unknown }
  ) => Promise<{ code: number; msg: string; body?: unknown }>
) {
  const { mop } = config;
  const { supplier, aes_key, private_key_path, public_key_path } = mop;
  const publicKey = await readFile(path.resolve(public_key_path), 'utf-8');
  const privateKey = await readFile(path.resolve(private_key_path), 'utf-8');

  return mockJSONServer(async ({ headers, path, body }) => {
    const requestSignVerified = verifyMopSign(
      headers.sign,
      path,
      {
        supplier: supplier,
        timestamp: headers.timestamp,
        version: headers.version,
        publicKey,
      },
    );

    if (requestSignVerified === false) {
      return buildMopResponse(1001, '签名验证失败', privateKey, aes_key);
    }

    const { encryptData } = body as { encryptData: string };

    let decrypted;
    try {
      decrypted = decryptMopData(encryptData, aes_key);
    } catch (_error) {
      return buildMopResponse(1001, '解密失败', privateKey, aes_key);
    }

    const requestBody = JSON.parse(decrypted);
    const {
      code, msg, body: responseBody
    } = await mopRequestHandler({ uri: path, body: requestBody });
    return buildMopResponse(code, msg, privateKey, aes_key, responseBody);
  });
}