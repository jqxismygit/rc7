import { Context, Errors, ServiceSchema } from 'moleculer';
import type { Order } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  releaseExpiredOrders,
  OrderDataError,
} from '../data/order.js';

interface UserMeta {
  uid: string;
}

const { MoleculerClientError } = Errors;

function handleOrderError(error: unknown): never {
  if ((error instanceof OrderDataError) === false) {
    throw error;
  }

  if (error.code === 'INVENTORY_NOT_ENOUGH') {
    throw new MoleculerClientError('库存不足', 400, 'INVENTORY_NOT_ENOUGH');
  }

  if (
    error.code === 'INVALID_ARGUMENT'
    || error.code === 'SESSION_NOT_FOUND'
    || error.code === 'TICKET_CATEGORY_NOT_FOUND'
  ) {
    throw new MoleculerClientError('参数不合法', 400, error.code);
  }

  if (error.code === 'ORDER_NOT_FOUND') {
    throw new MoleculerClientError('订单不存在或无权限', 404, 'ORDER_NOT_FOUND');
  }

  if (error.code === 'ORDER_STATUS_INVALID') {
    throw new MoleculerClientError('订单状态不允许取消', 400, 'ORDER_STATUS_INVALID');
  }

  throw new MoleculerClientError('未知订单错误', 500, 'UNKNOWN_ORDER_ERROR');
}

export class OrderService extends RC7BaseService {
  constructor(broker) {
    super(broker);
  }

  actions_order: ServiceSchema['actions'] = {
    'order.create': {
      rest: 'POST /:eid/sessions/:sid/orders',
      params: {
        eid: 'string',
        sid: 'string',
        items: 'array',
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

    'order.cancel': {
      rest: 'DELETE /:oid',
      params: {
        oid: 'string',
      },
      handler: this.cancelOrder,
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
    ctx: Context<{ eid: string; sid: string; items: Order.CreateOrderItem[] }, { user: UserMeta }>
  ) {
    const { eid, sid, items } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');
      const order = await createOrder(dbClient, schema, {
        user_id: uid,
        exhibit_id: eid,
        session_id: sid,
        items,
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
