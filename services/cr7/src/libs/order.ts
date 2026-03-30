import { Context, Errors, ServiceSchema } from 'moleculer';
import type { Order } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getOrders,
  getOrdersAdmin,
  hideOrder,
  releaseExpiredOrders,
} from '../data/order.js';
import { handleOrderError } from './errors.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
}

export class OrderService extends RC7BaseService {
  constructor(broker) {
    super(broker);
  }

  methods_order: ServiceSchema['methods'] = {
    createOrderWithTransaction: this.createOrderWithTransaction,
  };

  actions_order: ServiceSchema['actions'] = {
    'order.create': {
      rest: 'POST /:eid/sessions/:sid/orders',
      params: {
        id: {
          type: 'string',
          optional: true,
        },
        user_id: {
          type: 'string',
          optional: true,
        },
        eid: 'string',
        sid: 'string',
        items: 'array',
        source: {
          type: 'enum',
          values: ['DIRECT', 'CTRIP'],
          optional: true,
          default: 'DIRECT',
        },
      },
      handler: this.createOrder,
    },

    'order.get': {
      rest: 'GET /:oid',
      params: {
        oid: 'string',
      },
      handler: this.getOrder,
    },

    'order.list': {
      rest: 'GET /',
      params: {
        status: {
          type: 'enum',
          values: [
            'PENDING_PAYMENT',
            'PAID',
            'REFUND_REQUESTED',
            'REFUND_PROCESSING',
            'REFUNDED',
            'REFUND_FAILED',
            'CANCELLED',
            'EXPIRED',
          ],
          optional: true,
        },
        page: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
          default: 1,
          convert: true,
        },
        limit: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
          default: 20,
          convert: true,
        },
      },
      handler: this.listOrders,
    },

    'order.cancel': {
      rest: 'DELETE /:oid',
      params: {
        oid: 'string',
      },
      handler: this.cancelOrder,
    },

    'order.hide': {
      rest: 'PATCH /:oid/hide',
      params: {
        oid: 'string',
      },
      handler: this.hideOrder,
    },

    'order.listAdmin': {
      rest: 'GET /',
      roles: ['admin'],
      params: {
        status: {
          type: 'enum',
          values: [
            'PENDING_PAYMENT',
            'PAID',
            'REFUND_REQUESTED',
            'REFUND_PROCESSING',
            'REFUNDED',
            'REFUND_FAILED',
            'CANCELLED',
            'EXPIRED',
          ],
          optional: true,
        },
        page: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
          default: 1,
          convert: true,
        },
        limit: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
          default: 20,
          convert: true,
        },
      },
      handler: this.listOrdersAdmin,
    },

    'order.expire': {
      params: {
        batchSize: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
        },
      },
      handler: this.expireOrders,
    },

  };

  async createOrder(
    ctx: Context<{
      id?: string;
      user_id?: string;
      eid: string;
      sid: string;
      items: Order.CreateOrderItem[];
      source?: Order.OrderSource;
    }, { user?: UserMeta }>
  ) {
    const { id, user_id: inputUserId, eid, sid, items, source = 'DIRECT' } = ctx.params;
    const authUserId = ctx.meta.user?.uid;

    if (authUserId && inputUserId && inputUserId !== authUserId) {
      throw new MoleculerClientError('Insufficient permissions', 403, 'FORBIDDEN_ACCESS');
    }

    const user_id = inputUserId ?? authUserId;
    if (!user_id) {
      throw new MoleculerClientError('Missing user_id', 400, 'USER_ID_REQUIRED');
    }

    return this.createOrderWithTransaction({ id, user_id, eid, sid, items, source });
  }

  async createOrderWithTransaction(params: {
    id?: string;
    user_id: string;
    eid: string;
    sid: string;
    items: Order.CreateOrderItem[];
    source: Order.OrderSource;
  }) {
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');
      const order = await createOrder(dbClient, schema, {
        id: params.id,
        user_id: params.user_id,
        exhibit_id: params.eid,
        session_id: params.sid,
        items: params.items,
        source: params.source,
      });
      await dbClient.query('COMMIT');
      return order;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
  }

  async cancelOrder(
    ctx: Context<{ oid: string }, { user: UserMeta; $statusCode?: number }>
  ) {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    await ctx.call('cr7.wechatpay.close_order', { oid });
    try {
      await dbClient.query('BEGIN');
      await cancelOrder(dbClient, schema, oid, uid);
      await dbClient.query('COMMIT');
      ctx.meta.$statusCode = 204;
      return null;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
  }

  async getOrder(
    ctx: Context<{ oid: string }, { user: UserMeta }>
  ) {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();

    return getOrderById(this.pool, schema, oid, uid)
      .catch(handleOrderError);
  }

  async listOrders(
    ctx: Context<{
      status?: Order.OrderStatus;
      page?: number;
      limit?: number;
    }, { user: UserMeta }>
  ) {
    const {
      status,
      page = 1,
      limit = 20,
    } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();

    return getOrders(this.pool, schema, uid, {
      status,
      page,
      limit,
    }).catch(handleOrderError);
  }

  async hideOrder(
    ctx: Context<{ oid: string }, { user: UserMeta; $statusCode?: number }>
  ) {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');
      await hideOrder(dbClient, schema, oid, uid);
      await dbClient.query('COMMIT');
      ctx.meta.$statusCode = 204;
      return null;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
  }

  async listOrdersAdmin(
    ctx: Context<{
      status?: Order.OrderStatus;
      page?: number;
      limit?: number;
    }, { user: UserMeta }>
  ) {
    const {
      status,
      page = 1,
      limit = 20,
    } = ctx.params;
    const schema = await this.getSchema();

    return getOrdersAdmin(this.pool, schema, {
      status,
      page,
      limit,
    }).catch(handleOrderError);
  }

  async expireOrders(
    ctx: Context<{ batchSize?: number }>
  ) {
    const { batchSize = 100 } = ctx.params;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');
      const processed = await releaseExpiredOrders(
        dbClient,
        schema,
        new Date(),
        batchSize,
      );
      await dbClient.query('COMMIT');
      return { processed };
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
  }
}
