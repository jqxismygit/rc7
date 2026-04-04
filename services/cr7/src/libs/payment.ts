import { promises as fsPromises } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Context, ServiceBroker, ServiceSchema } from 'moleculer';
import { format } from 'date-fns';
import { addMinutes } from 'date-fns';
import { PoolClient } from 'pg';
import type { Payment } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  assertOrderRefundableByPolicies,
  assertOrderRefundableByStatus,
  createRefundRecord,
  getCurrentRefundRecordByOrderId,
  PaymentDataError,
  createWechatPayCallback,
  createWechatRefundCallback,
  getOrderRefundInfo,
  listRefundRecordsByOrderId,
  getOutTradeNoByOrderId,
  getOrderPaymentInfo,
  markWechatPayCallbackProcessed,
  markWechatRefundCallbackProcessed,
  upsertWechatPayTransaction,
  updateWechatPayCallbackFields,
  updateWechatPayTransactionPrepayId,
  updateRefundRecordFromApplyResponse,
  updateRefundRecordFromCallback,
  updateWechatRefundCallbackFields,
} from '../data/payment.js';
import { getTicketCategoryRefundPoliciesByOrderId } from '../data/exhibition.js';
import {
  markOrderRefunded,
  releaseOrderInventory,
  setOrderCurrentRefund,
} from '../data/order.js';
import { handlePaymentDataError } from './errors.js';
import {
  decryptWechatCallbackPayload,
  decryptWechatCallbackResource,
  wePayPostJSON,
  signPay,
  WechatCallbackResource,
} from './wechatpay.js';

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

interface WechatRefundRequestBody {
  out_trade_no: string;
  out_refund_no: string;
  reason: string;
  notify_url: string;
  amount: {
    refund: number;
    total: number;
    currency: 'CNY';
  };
}

interface WechatRefundResponse {
  refund_id?: string;
  out_refund_no?: string;
  out_trade_no?: string;
  status?: string;
  channel?: string;
  amount?: {
    refund?: number;
    total?: number;
  };
}

interface WechatCallbackNotification {
  id: string;
  event_type: string;
  resource: WechatCallbackResource;
}

type WechatRefundCallbackResource = {
  out_trade_no: string;
  out_refund_no: string;
  refund_status: string;
  refund_id: string;
  channel: string;
  success_time: string;
  reason: string;
  amount: {
    refund: number;
    total: number;
  };
};

export class PaymentService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
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

    'order.refund': {
      rest: 'POST /:oid/refund',
      params: {
        oid: 'string',
        reason: {
          type: 'string',
          optional: true,
        },
      },
      handler: this.initiateRefund,
    },

    'order.refundsAdmin': {
      rest: 'GET /:oid/refunds',
      roles: ['admin'],
      params: {
        oid: 'string',
      },
      handler: this.listOrderRefundsAdmin,
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

    'wechatpay.refundCallback': {
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
      handler: this.handleWechatRefundCallback,
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
    refundOrderAndReleaseInventory: this.refundOrderAndReleaseInventory,
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
      appid, mchid, callback_base_url,
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
      notify_url: `${callback_base_url}/payment/wechat/callback`,
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

  async initiateRefund(
    ctx: Context<{ oid: string; reason?: string }, { user: UserMeta }>
  ): Promise<Payment.RefundRecord> {
    const { oid, reason = '用户发起退款' } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();

    const dbClient = await this.pool.connect();
    try {
      await dbClient.query('BEGIN');

      const order = await getOrderRefundInfo(dbClient, schema, oid, uid)
        .catch(handlePaymentDataError);
      assertOrderRefundableByStatus(order);

      const policies = await getTicketCategoryRefundPoliciesByOrderId(dbClient, schema, oid);
      assertOrderRefundableByPolicies(policies, order.session_date, new Date());

      if (order.out_trade_no === null) {
        throw new PaymentDataError('Order status invalid for refund', 'ORDER_STATUS_INVALID');
      }

      const outRefundNo = randomUUID().replace(/-/g, '');
      await createRefundRecord(dbClient, schema, {
        out_refund_no: outRefundNo,
        order_id: oid,
        out_trade_no: order.out_trade_no!,
        order_amount: order.total_amount,
        refund_amount: order.total_amount,
        reason,
      });
      await setOrderCurrentRefund(dbClient, schema, oid, outRefundNo);

      const wechatpayConfig = await this.getWechatPayConfig();
      const {
        base_url,
        mchid,
        client_key_serial_no,
        client_key_path,
        callback_base_url,
      } = wechatpayConfig;

      const refundNotifyUrl = `${callback_base_url}/payment/wechat/callback/refund`;

      const privateKey = await this.getWechatPayClientPrimaryKey(client_key_path);
      const requestBody: WechatRefundRequestBody = {
        out_trade_no: order.out_trade_no!,
        out_refund_no: outRefundNo,
        reason,
        notify_url: refundNotifyUrl,
        amount: {
          refund: order.total_amount,
          total: order.total_amount,
          currency: 'CNY',
        },
      };

      const response = await wePayPostJSON<WechatRefundResponse>(
        `${base_url}/v3/refund/domestic/refunds`,
        {
          body: requestBody,
          mchid,
          serialNo: client_key_serial_no,
          privateKey,
        },
      );

      await updateRefundRecordFromApplyResponse(dbClient, schema, outRefundNo, {
        refund_id: response.refund_id ?? null,
        refund_status: response.status ?? null,
        refund_channel: response.channel ?? null,
        callback_refund_amount: response.amount?.refund ?? null,
      });

      const updated = await getCurrentRefundRecordByOrderId(dbClient, schema, oid)
        .catch(handlePaymentDataError);

      await dbClient.query('COMMIT');
      return updated;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handlePaymentDataError(error);
    } finally {
      dbClient.release();
    }
  }

  async listOrderRefundsAdmin(
    ctx: Context<{ oid: string }>
  ): Promise<Payment.RefundRecord[]> {
    const { oid } = ctx.params;
    const schema = await this.getSchema();
    return listRefundRecordsByOrderId(this.pool, schema, oid);
  }

  async handleWechatCallback(
    ctx: Context<WechatCallbackNotification, { $statusCode?: number }>
  ) {
    const notification = ctx.params;
    const schema = await this.getSchema();

    await createWechatPayCallback(this.pool, schema, {
      wechat_notification_id: notification.id,
      event_type: notification.event_type,
      out_trade_no: null,
      transaction_id: null,
      trade_state: null,
      raw_payload: notification,
    });

    const { api_v3_secret } = await this.getWechatPayConfig();
    const transactionResult = decryptWechatCallbackResource(notification.resource, api_v3_secret);

    const orderId = await updateWechatPayCallbackFields(this.pool, schema, notification.id, {
      out_trade_no: transactionResult.out_trade_no,
      transaction_id: transactionResult.transaction_id,
      trade_state: transactionResult.trade_state,
    });

    if (
      notification.event_type === 'TRANSACTION.SUCCESS'
      && transactionResult.trade_state === 'SUCCESS'
      && orderId !== null
    ) {
      await ctx.call('cr7.order.markPaid', { oid: orderId });
    }

    await markWechatPayCallbackProcessed(this.pool, schema, notification.id);

    ctx.meta.$statusCode = 204;
    return null;
  }

  async refundOrderAndReleaseInventory(
    dbClient: PoolClient, schema: string,
    orderId: string, outRefundNo: string
  ) {
     const settlement = await markOrderRefunded(
        dbClient,
        schema,
        orderId,
        outRefundNo,
     );

     if (settlement === null) {
       return;
     }

     if (settlement.released_at !== null) {
       return;
     }

    await releaseOrderInventory(
      dbClient,
      schema,
      orderId,
      settlement.session_id,
    );
  }

  async handleWechatRefundCallback(
    ctx: Context<WechatCallbackNotification, { $statusCode?: number }>
  ) {
    const notification = ctx.params;
    const schema = await this.getSchema();

    await createWechatRefundCallback(
      this.pool, schema,
      {
        notification_id: notification.id,
        event_type: notification.event_type,
        out_trade_no: null,
        out_refund_no: null,
        refund_status: null,
        raw_payload: notification,
      }
    );

    const { api_v3_secret } = await this.getWechatPayConfig();
    const payload = decryptWechatCallbackPayload(
      notification.resource, api_v3_secret
    ) as WechatRefundCallbackResource;

    const {
      out_trade_no, out_refund_no, refund_status,
      refund_id, channel, amount, reason, success_time
    } = payload;

    await updateWechatRefundCallbackFields(
      this.pool, schema, notification.id,
      { out_trade_no, out_refund_no, refund_status }
    );

    const dbClient = await this.pool.connect();
    try {
      await dbClient.query('BEGIN');

      const updated = await updateRefundRecordFromCallback(
        dbClient,
        schema,
        out_refund_no!,
        {
          refund_status: refund_status!,
          refund_id,
          refund_channel: channel,
          callback_refund_amount: amount.refund,
          error_message: reason,
          succeeded_at: success_time,
          failed_at: refund_status === 'SUCCESS' ? null : new Date(),
        },
      ).catch(handlePaymentDataError);

      if (updated?.status === 'SUCCEEDED') {
        await this.refundOrderAndReleaseInventory(
          dbClient, schema, updated.order_id, out_refund_no!
        );
      }

      await markWechatRefundCallbackProcessed(dbClient, schema, notification.id);
      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }

    ctx.meta.$statusCode = 204;
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

  async getWechatPayClientPrimaryKey(client_key_path: string): Promise<string> {
    return fsPromises.readFile(client_key_path, 'utf-8');
  }
}
