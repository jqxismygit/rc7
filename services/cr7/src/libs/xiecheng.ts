import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { Errors } from 'moleculer';
import { fetch, HeadersInit, RequestInit } from 'undici';

const { MoleculerClientError } = Errors;

class XieChengAPIError extends Error {
  status: number;
  url: string;
  method: string;
  body: unknown;

  constructor(
    status: number,
    url: string,
    method: string,
    body: unknown,
  ) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const message = `${status} - ${method} ${url} - ${data}`;
    super(message);
    this.status = status;
    this.url = url;
    this.method = method;
    this.body = body;
  }
}

interface XieChengSignOptions {
  accountId: string;
  serviceName: string;
  requestTime?: string;
  version?: string;
  signKey: string;
}

interface XieChengCryptoOptions {
  aesKey: string;
  aesIv: string;
}

interface XieChengBuildRequestOptions extends XieChengSignOptions, XieChengCryptoOptions {
  body: unknown;
}

interface XieChengPostJSONOptions extends Omit<RequestInit, 'method' | 'body'>, XieChengBuildRequestOptions {
}

interface XieChengRequestHeader {
  accountId: string;
  serviceName: string;
  requestTime: string;
  version: string;
  sign: string;
}

interface XieChengRequestPayload {
  header: XieChengRequestHeader;
  body: string;
}

interface XieChengResponseHeader {
  resultCode: string;
  resultMessage?: string;
}

interface XieChengPriceInventoryResponse {
  header?: XieChengResponseHeader;
  [key: string]: unknown;
}

export class XieChengBusinessError extends Error {
  resultCode: string;
  resultMessage: string;
  response: unknown;

  constructor(resultCode: string, resultMessage: string, response: unknown) {
    super(`[${resultCode}] ${resultMessage}`);
    this.name = 'XieChengBusinessError';
    this.resultCode = resultCode;
    this.resultMessage = resultMessage;
    this.response = response;
  }
}

function formatRequestTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function encodeXieChengBytes(bytes: Buffer): string {
  let result = '';
  for (const byte of bytes) {
    const normalized = byte & 0xff;
    result += String.fromCharCode(((normalized >> 4) & 0x0f) + 97);
    result += String.fromCharCode((normalized & 0x0f) + 97);
  }
  return result;
}

export function decodeXieChengBytes(encoded: string): Buffer {
  if (encoded.length % 2 !== 0) {
    throw new MoleculerClientError('携程密文格式错误', 400, 'XIECHENG_CIPHER_INVALID');
  }

  const bytes = Buffer.alloc(encoded.length / 2);
  for (let i = 0; i < encoded.length; i += 2) {
    const high = encoded.charCodeAt(i) - 97;
    const low = encoded.charCodeAt(i + 1) - 97;
    if (high < 0 || high > 15 || low < 0 || low > 15) {
      throw new MoleculerClientError('携程密文格式错误', 400, 'XIECHENG_CIPHER_INVALID');
    }
    bytes[i / 2] = ((high << 4) | low) & 0xff;
  }
  return bytes;
}

function assertAESConfig(key: string, iv: string) {
  if (Buffer.byteLength(key, 'utf-8') !== 16 || Buffer.byteLength(iv, 'utf-8') !== 16) {
    throw new MoleculerClientError('携程 AES key/iv 必须是 16 位', 400, 'XIECHENG_AES_INVALID');
  }
}

export function encryptXieChengBody(plainTextBody: string, key: string, iv: string): string {
  assertAESConfig(key, iv);
  const cipher = createCipheriv(
    'aes-128-cbc',
    Buffer.from(key, 'utf-8'),
    Buffer.from(iv, 'utf-8'),
  );
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plainTextBody, 'utf-8')),
    cipher.final(),
  ]);
  return encodeXieChengBytes(encrypted);
}

export function decryptXieChengBody(cipherTextBody: string, key: string, iv: string): string {
  assertAESConfig(key, iv);
  const cipherBuffer = decodeXieChengBytes(cipherTextBody);
  const decipher = createDecipheriv(
    'aes-128-cbc',
    Buffer.from(key, 'utf-8'),
    Buffer.from(iv, 'utf-8'),
  );
  const decrypted = Buffer.concat([
    decipher.update(cipherBuffer),
    decipher.final(),
  ]);
  return decrypted.toString('utf-8');
}

export function buildXieChengSign(body: string, options: XieChengSignOptions) {
  const requestTime = options.requestTime ?? formatRequestTime();
  const version = options.version ?? '1.0';
  const { accountId, serviceName, signKey } = options;
  const message = `${accountId}${serviceName}${requestTime}${body}${version}${signKey}`;
  const sign = createHash('md5').update(message, 'utf-8').digest('hex').toLowerCase();

  return {
    sign,
    message,
    requestTime,
    version,
  };
}

export function buildXieChengRequest(options: XieChengBuildRequestOptions) {
  const plainBody = typeof options.body === 'string'
    ? options.body
    : JSON.stringify(options.body);

  const body = encryptXieChengBody(plainBody, options.aesKey, options.aesIv);
  const signResult = buildXieChengSign(body, options);

  const payload: XieChengRequestPayload = {
    header: {
      accountId: options.accountId,
      serviceName: options.serviceName,
      requestTime: signResult.requestTime,
      version: signResult.version,
      sign: signResult.sign,
    },
    body,
  };

  return {
    payload,
    plainBody,
    encryptedBody: body,
    sign: signResult.sign,
    signMessage: signResult.message,
  };
}

function getHeaders(options: XieChengPostJSONOptions): HeadersInit {
  return Object.assign(
    { ...options.headers },
    {
      'content-type': 'application/json',
      'Accept': 'application/json',
    },
  ) as HeadersInit;
}

export async function xieChengPostJSON<Res = unknown>(
  url: string,
  options: XieChengPostJSONOptions,
) {
  const request = buildXieChengRequest(options);
  const requestBody = JSON.stringify(request.payload);

  const res = await fetch(url, {
    ...options,
    method: 'POST',
    headers: getHeaders(options),
    body: requestBody,
  });

  const contentType = res.headers.get('content-type') || '';
  const responseBody = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  if (res.ok === false) {
    throw new XieChengAPIError(res.status, url, 'POST', responseBody);
  }

  return responseBody as Res;
}

function parseXieChengResponseHeader(response: unknown): XieChengResponseHeader {
  if (typeof response !== 'object' || response === null) {
    throw new MoleculerClientError('携程接口响应格式错误', 502, 'XIECHENG_RESPONSE_INVALID');
  }

  const header = (response as XieChengPriceInventoryResponse).header;
  if (typeof header !== 'object' || header === null) {
    throw new MoleculerClientError('携程接口响应格式错误', 502, 'XIECHENG_RESPONSE_INVALID');
  }

  const resultCode = header.resultCode;
  if (typeof resultCode !== 'string' || resultCode.length === 0) {
    throw new MoleculerClientError('携程接口响应格式错误', 502, 'XIECHENG_RESPONSE_INVALID');
  }

  const resultMessage = header.resultMessage;
  return {
    resultCode,
    resultMessage: typeof resultMessage === 'string' ? resultMessage : undefined,
  };
}

export function assertXieChengPriceInventoryResult(response: unknown) {
  const { resultCode, resultMessage } = parseXieChengResponseHeader(response);
  if (resultCode === '0000') {
    return;
  }

  throw new XieChengBusinessError(
    resultCode,
    resultMessage ?? '携程接口返回业务错误',
    response,
  );
}

export async function xieChengSyncPrice(
  url: string,
  options: Omit<XieChengPostJSONOptions, 'serviceName'>,
) {
  const response = await xieChengPostJSON<XieChengPriceInventoryResponse>(url, {
    ...options,
    serviceName: 'DatePriceModify',
  });

  assertXieChengPriceInventoryResult(response);
  return response;
}

export async function xieChengSyncInventory(
  url: string,
  options: Omit<XieChengPostJSONOptions, 'serviceName'>,
) {
  const response = await xieChengPostJSON<XieChengPriceInventoryResponse>(url, {
    ...options,
    serviceName: 'DateInventoryModify',
  });

  assertXieChengPriceInventoryResult(response);
  return response;
}

export async function xieChengSendConsumedNotice(
  url: string,
  options: Omit<XieChengPostJSONOptions, 'serviceName'>,
) {
  const response = await xieChengPostJSON<XieChengPriceInventoryResponse>(url, {
    ...options,
    serviceName: 'OrderConsumedNotice',
  });

  assertXieChengPriceInventoryResult(response);
  return response;
}
