import { Server } from 'node:http';
import { createCipheriv, randomBytes } from 'node:crypto';
import config from 'config';
import { vi } from 'vitest';
import { postJSON } from '../lib/api.js';
import { mockJSONServer } from '../lib/server.js';
import { Payment } from '@cr7/types';

export async function initiatePayment(
  server: Server,
  orderId: string,
  token: string,
) {
  return postJSON<Payment.PaySignResult>(
    server,
    `/orders/${orderId}/wechatpay`,
    { token }
  );
}

/**
 * 使用 AES-256-GCM 加密回调资源，模拟微信支付回调 resource.ciphertext
 * @param plaintext  解密后的业务数据（transaction 对象）
 * @param apiV3Secret  APIv3 密钥（32字节或32字符 UTF-8 字符串）
 */
export function encryptCallbackResource(
  plaintext: object,
  apiV3Secret: string,
): { ciphertext: string; nonce: string; associated_data: string } {
  const key = Buffer.from(apiV3Secret.padEnd(32, '0').slice(0, 32), 'utf-8');
  const nonce = randomBytes(12).toString('hex').slice(0, 12);
  const associated_data = 'transaction';

  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(associated_data));

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]).toString('base64');

  return { ciphertext, nonce, associated_data };
}

export interface WechatTransactionResult {
  transaction_id: string;
  out_trade_no: string;
  trade_state: 'SUCCESS' | 'NOTPAY' | 'CLOSED';
  trade_state_desc: string;
  mchid: string;
  appid: string;
  trade_type: 'JSAPI';
  bank_type: string;
  success_time: string;
  payer: { openid: string };
  amount: { total: number; payer_total: number; currency: string; payer_currency: string };
}

/**
 * 构造微信支付回调通知 body（含加密资源）
 */
export function buildCallbackNotification(
  transactionResult: WechatTransactionResult,
  apiV3Secret: string,
) {
  const { ciphertext, nonce, associated_data } = encryptCallbackResource(
    transactionResult,
    apiV3Secret,
  );

  return {
    id: `EV-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    create_time: new Date().toISOString(),
    resource_type: 'encrypt-resource',
    event_type: 'TRANSACTION.SUCCESS',
    summary: '支付成功',
    resource: {
      original_type: 'transaction',
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext,
      associated_data,
      nonce,
    },
  };
}

/**
 * 向 cr7 服务发送微信支付回调通知
 * 测试中签名头使用占位值，需配合 spy mock 验签函数
 */
export async function sendWechatCallback(
  server: Server,
  notification: ReturnType<typeof buildCallbackNotification>,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString('hex').toUpperCase();

  const wechatHeaders = {
    'wechatpay-timestamp': timestamp,
    'wechatpay-nonce': nonce,
    'wechatpay-serial': 'TEST_SERIAL',
    'wechatpay-signature': 'TEST_SIGNATURE',
    ...headers,
  };

  return postJSON<unknown>(
    server,
    '/payment/wechat/callback',
    { body: notification, headers: wechatHeaders }
  );
}

export async function prepareOrderForPayment(
  apiServer: Server,
  token: string,
  order: { id: string; total_amount: number },
) {
  const mockServer = await mockJSONServer(async () => ({
    prepay_id: `mock_prepay_${Date.now()}`,
  }));
  const baseUrlSpy = vi
    .spyOn(config.wechatpay, 'base_url', 'get')
    .mockReturnValue(mockServer.address);

  try {
    await initiatePayment(apiServer, order.id, token);
  } finally {
    baseUrlSpy.mockRestore();
    await mockServer.close();
  }
}

export async function markOrderAsPaidForTest(
  apiServer: Server,
  token: string,
  order: { id: string; total_amount: number },
  userOpenid: string,
) {
  await prepareOrderForPayment(apiServer, token, order);

  const notification = buildCallbackNotification(
    {
      transaction_id: `wxpay_txn_${Date.now()}`,
      out_trade_no: order.id.replace(/-/g, ''),
      trade_state: 'SUCCESS',
      trade_state_desc: '支付成功',
      mchid: config.wechatpay.mchid,
      appid: config.wechatpay.appid,
      trade_type: 'JSAPI',
      bank_type: 'OTHERS',
      success_time: new Date().toISOString(),
      payer: { openid: userOpenid },
      amount: {
        total: order.total_amount,
        payer_total: order.total_amount,
        currency: 'CNY',
        payer_currency: 'CNY',
      },
    } satisfies WechatTransactionResult,
    config.wechatpay.api_v3_secret,
  );

  await sendWechatCallback(apiServer, notification);
}
