import { promises as fsPromises } from 'node:fs';
import { Context, Errors, ServiceSchema } from 'moleculer';
import { format } from 'date-fns';
import { addMinutes } from 'date-fns';
import type { Payment } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  getOrderPaymentInfo,
  upsertWechatPayTransaction,
  updateWechatPayTransactionPrepayId,
  PaymentDataError,
} from '../data/payment.js';
import { wePayPostJSON, signPay } from './wechatpay.js';

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
      handler: this.handleWechatCallback,
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
        total: orderInfo.total_amount,
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
    ctx: Context<unknown, { $statusCode?: number }>
  ) {
    // TODO: implement callback handling
    ctx.meta.$statusCode = 204;
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
