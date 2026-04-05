import { Server } from 'node:http';
import { postJSON } from '../lib/api.js';
import {
  buildMopResponseSign, decryptMopData, encryptMopData, verifyMopSign
} from '@/libs/mop.js';
import { format } from 'date-fns';
import config from 'config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { mockJSONServer } from '../lib/server.js';

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