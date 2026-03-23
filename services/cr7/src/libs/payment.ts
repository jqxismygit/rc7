import { promises as fsPromises } from 'node:fs';
import { Context, Errors, ServiceSchema } from 'moleculer';
import { format } from 'date-fns';
import { addMinutes } from 'date-fns';
import type { Payment } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  createWechatPayCallback,
  getOutTradeNoByOrderId,
  getOrderPaymentInfo,
  markOrderPaidByOutTradeNo,
  markWechatPayCallbackProcessed,
  upsertWechatPayTransaction,
  updateWechatPayTransactionPrepayId,
  PaymentDataError,
} from '../data/payment.js';
import {
  decryptWechatCallbackResource,
  wePayPostJSON,
  signPay,
  WechatCallbackResource,
} from './wechatpay.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
}

interface WechatPayJSAPIRequestBody {
  appid: string;
  mchid: string;
  description: string;
  out_trade_no: string;
  time_expire: string;
  notify_url: string;
  amount: { total: number; currency: 'CNY' };
  payer: { openid: string };
}

interface WechatPayJSAPIResponse {
  prepay_id: string;
}

interface WechatPayCloseOrderRequestBody {
  mchid: string;
}

interface WechatCallbackNotification {
  id: string;
  event_type: string;
  resource: WechatCallbackResource;
}

function handlePaymentDataError(error: unknown): never {
  if ((error instanceof PaymentDataError) === false) {
    throw error;
  }

  if (error.code === 'ORDER_NOT_FOUND') {
    throw new MoleculerClientError('订单不存在或无权限', 404, 'ORDER_NOT_FOUND');
  }

  if (error.code === 'ORDER_STATUS_INVALID') {
    throw new MoleculerClientError('订单状态不允许支付', 400, 'ORDER_STATUS_INVALID');
  }

  if (error.code === 'USER_NO_OPENID') {
    throw new MoleculerClientError('用户未绑定微信账号', 409, 'USER_NO_OPENID');
  }

  throw new MoleculerClientError('支付服务错误', 500, 'PAYMENT_ERROR');
}

export class PaymentService extends RC7BaseService {
  constructor(broker) {
    super(broker);


  }

  actions_payment: ServiceSchema['actions'] = {
    'order.wechatpay': {
      rest: 'POST /:oid/wechatpay',
      params: {
        oid: 'string',
      },
      handler: this.initiateWechatPay,
    },

    'wechatpay.callback': {
      params: {
        id: 'string',
        event_type: 'string',
        resource: {
          type: 'object',
          props: {
            ciphertext: 'string',
            nonce: 'string',
            associated_data: { type: 'string', optional: true },
          },
        },
      },
      handler: this.handleWechatCallback,
    },

    'wechatpay.close_order': {
      params: {
        oid: 'string',
      },
      handler: this.closeWechatOrderByOrderId,
    }
  };

  methods = {
    getWechatPayClientPrimaryKey: this.getWechatPayClientPrimaryKey,
    getWechatPayConfig: this.getWechatPayConfig,
  }

  async initiateWechatPay(
    ctx: Context<{ oid: string }, { user: UserMeta; $statusCode?: number }>
  ): Promise<Payment.PaySignResult> {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();

    const orderInfo = await getOrderPaymentInfo(this.pool, schema, oid, uid)
      .catch(handlePaymentDataError);

    const wechatpayConfig = await this.getWechatPayConfig();
    const {
      appid, mchid, callback_url,
      client_key_serial_no,
      client_key_path
    } = wechatpayConfig;
    const privateKey = await this.getWechatPayClientPrimaryKey(client_key_path);

    await upsertWechatPayTransaction(
      this.pool,
      schema,
      orderInfo.order_id,
      orderInfo.out_trade_no,
      orderInfo.total_amount,
      orderInfo.openid,
    );

    const createdAt = new Date(orderInfo.created_at);
    const timeExpire = addMinutes(createdAt, 30);
    const timeExpireStr = format(timeExpire, "yyyy-MM-dd'T'HH:mm:ssxxx");

    const requestBody: WechatPayJSAPIRequestBody = {
      appid,
      mchid: mchid,
      description: orderInfo.description,
      out_trade_no: orderInfo.out_trade_no,
      time_expire: timeExpireStr,
      notify_url: callback_url,
      amount: {
        // 微信支付接口要求金额单位为分，且必须是整数
        total: Math.round(orderInfo.total_amount * 100),
        currency: 'CNY',
      },
      payer: {
        openid: orderInfo.openid,
      },
    };

    const response = await wePayPostJSON<WechatPayJSAPIResponse>(
      `${wechatpayConfig.base_url}/v3/pay/transactions/jsapi`,
      {
        body: requestBody,
        mchid,
        serialNo: client_key_serial_no,
        privateKey,
      },
    );

    await updateWechatPayTransactionPrepayId(
      this.pool,
      schema,
      orderInfo.out_trade_no,
      response.prepay_id,
    );

    const paySign = signPay(response.prepay_id, { appid, privateKey });

    return {
      timeStamp: paySign.timeStamp,
      nonceStr: paySign.nonceStr,
      package: paySign.package,
      signType: paySign.signType,
      paySign: paySign.paySign,
    };
  }

  async handleWechatCallback(
    ctx: Context<WechatCallbackNotification, { $statusCode?: number }>
  ) {
    const notification = ctx.params;
    const schema = await this.getSchema();
    let paidOrderId: string | null = null;

    const { api_v3_secret } = await this.getWechatPayConfig();
    const transactionResult = decryptWechatCallbackResource(notification.resource, api_v3_secret);

    const dbClient = await this.pool.connect();
    try {
      await dbClient.query('BEGIN');

      await createWechatPayCallback(dbClient, schema, {
        wechat_notification_id: notification.id,
        event_type: notification.event_type,
        out_trade_no: transactionResult.out_trade_no,
        transaction_id: transactionResult.transaction_id,
        trade_state: transactionResult.trade_state,
        raw_payload: notification,
      });

      if (
        notification.event_type === 'TRANSACTION.SUCCESS'
        && transactionResult.trade_state === 'SUCCESS'
      ) {
        paidOrderId = await markOrderPaidByOutTradeNo(
          dbClient,
          schema,
          transactionResult.out_trade_no,
        );
      }

      await markWechatPayCallbackProcessed(dbClient, schema, notification.id);
      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }

    if (paidOrderId !== null) {
      try {
        await ctx.call('cr7.redemption.generateByOrder', { oid: paidOrderId });
      } catch (error) {
        this.logger.error('Failed to generate redemption code after payment', {
          orderId: paidOrderId,
          outTradeNo: transactionResult.out_trade_no,
          error,
        });
      }
    }

    ctx.meta.$statusCode = 204;
    return null;
  }

  async closeWechatOrderByOrderId(
    ctx: Context<{ oid: string }, { user: UserMeta }>
  ) {
    const { oid } = ctx.params;
    const uid = ctx.meta.user.uid;

    const schema = await this.getSchema();
    const closeOrderInfo = await getOutTradeNoByOrderId(this.pool, schema, oid);
    if (closeOrderInfo === null) {
      return null;
    }

    if (closeOrderInfo.user_id !== uid) {
      return null;
    }

    const {
      mchid,
      base_url,
      client_key_serial_no,
      client_key_path,
    } = await this.getWechatPayConfig();

    const privateKey = await this.getWechatPayClientPrimaryKey(client_key_path);
    const closeOrderRequestBody: WechatPayCloseOrderRequestBody = { mchid };
    await wePayPostJSON<null>(
      `${base_url}/v3/pay/transactions/out-trade-no/${closeOrderInfo.out_trade_no}/close`,
      {
        body: closeOrderRequestBody,
        mchid,
        serialNo: client_key_serial_no,
        privateKey,
      },
    );

    return null;
  }

  async getWechatPayConfig() {
    const { default: config } = await import('config');
    return config.wechatpay;
  }

  async getWechatPayClientPrimaryKey(client_key_path?: string): Promise<string> {
    return fsPromises.readFile(client_key_path, 'utf-8');
  }
}
