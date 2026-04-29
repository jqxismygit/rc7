import { format } from 'date-fns';
import { Context, Errors, ServiceBroker, ServiceSchema } from 'moleculer';
import type { Order } from '@cr7/types';
import { CR7BaseService } from './cr7.base.js';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  OrderDataError,
  getOrders,
  getOrdersAdmin,
  hideOrder,
  markOrderPaid as markOrderPaidData,
  markOrderRefundedDirect as markOrderRefundedDirectData,
  releaseExpiredOrders,
  type OrderRaw,
} from '../data/order.js';
import {
  getExhibitionsByIds,
  getSessionsByIds,
  getTicketCategoriesByIds,
} from '../data/exhibition.js';
import { getInvoicesByOrderIds } from '../data/invoice.js';
import { getRefundsByOutRefundNos } from '../data/payment.js';
import { handleExhibitionError, handleOrderError } from './errors.js';
import { parseSelectedSessionId, HALF_SESSION_ID_REGEX } from './session-id.js';

const { MoleculerClientError } = Errors;
interface UserMeta {
  uid: string;
}

const createOrderItemsParamsSchema = {
  type: 'array',
  min: 1,
  max: 6,
  items: {
    type: 'object',
    props: {
      ticket_category_id: 'string|min:1',
      quantity: {
        type: 'number',
        min: 1,
        max: 6,
        integer: true,
        positive: true,
        convert: true,
      },
    },
  },
};

export class OrderService extends CR7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);
  }

  methods_order: ServiceSchema['methods'] = {
    createOrderWithTransaction: this.createOrderWithTransaction,
    assembleOrders: this.assembleOrders,
  };

  actions_order: ServiceSchema['actions'] = {
    'order.createWithWechatPay': {
      rest: 'POST /:eid/sessions/:sid/orders',
      params: {
        eid: 'string',
        sid: 'string',
        items: createOrderItemsParamsSchema,
      },
      handler: this.createWechatPayOrder,
    },
    'order.create': {
      rest: 'POST /:eid/sessions/:sid/orders',
      params: {
        id: {
          type: 'uuid',
          optional: true,
        },
        user_id: 'uuid',
        eid: 'uuid',
        sid: [
          'uuid',
          { type: 'string', pattern: HALF_SESSION_ID_REGEX.source },
        ],
        items: createOrderItemsParamsSchema,
        merge_items: {
          type: 'boolean',
          optional: true,
          default: true,
          convert: true,
        },
        source: {
          type: 'enum',
          values: ['CTRIP', 'MOP', 'DAMAI'],
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

    'order.getAdmin': {
      rest: 'GET /:oid',
      roles: ['admin'],
      params: {
        oid: 'string',
      },
      handler: this.getOrderAdmin,
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

    'order.markPaid': {
      params: {
        oid: 'string',
      },
      handler: this.markOrderPaid,
    },

    'order.markRefunded': {
      params: {
        oid: 'string',
      },
      handler: this.markOrderRefunded,
    },

  };

  async createWechatPayOrder(
    ctx: Context<{
      eid: string;
      sid: string;
      items: Order.CreateOrderItem[];
    }, { user: UserMeta }>
  ) {
    const { uid } = ctx.meta.user;
    const profile = await ctx.call<{ phone: string | null }>('user.profile');

    if (!profile.phone) {
      throw new MoleculerClientError('请先绑定手机号', 409, 'PHONE_NOT_BOUND');
    }

    const { eid, sid, items } = ctx.params;
    return this.createOrderWithTransaction({
      user_id: uid, eid, sid, items, source: 'DIRECT'
    });
  }

  async createOrder(
    ctx: Context<{
      id?: string;
      user_id: string;
      eid: string;
      sid: string;
      items: Order.CreateOrderItem[];
      merge_items?: boolean;
      source: Order.OrderSource;
    }>
  ) {
    const { id, user_id, eid, sid, items, merge_items, source } = ctx.params;
    if (!user_id) {
      throw new MoleculerClientError('Missing user_id', 400, 'USER_ID_REQUIRED');
    }

    return this.createOrderWithTransaction({
      id,
      user_id,
      eid,
      sid,
      items,
      merge_items,
      source,
    });
  }

  async createOrderWithTransaction(params: {
    id?: string;
    user_id: string;
    eid: string;
    sid: string;
    items: Order.CreateOrderItem[];
    merge_items?: boolean;
    source: Order.OrderSource;
  }) {
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();
    const { sessionId, sessionHalf } = parseSelectedSessionId(params.sid);

    let rawOrder: OrderRaw;
    try {
      await dbClient.query('BEGIN');
      rawOrder = await createOrder(dbClient, schema, {
        id: params.id,
        user_id: params.user_id,
        exhibit_id: params.eid,
        session_id: sessionId,
        session_half: sessionHalf,
        items: params.items,
        merge_items: params.merge_items,
        source: params.source,
      });
      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
    const [assembled] = await this.assembleOrders(schema, [rawOrder]);
    return assembled;
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

    const rawOrder = await getOrderById(this.pool, schema, oid)
      .then((order) => {
        if (order.user_id !== uid) {
          throw new OrderDataError('Order not found', 'ORDER_NOT_FOUND');
        }
        return order;
      })
      .catch(handleOrderError);
    const [assembled] = await this.assembleOrders(schema, [rawOrder]);
    return assembled;
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

    const result = await getOrders(this.pool, schema, uid, {
      status,
      page,
      limit,
    }).catch(handleOrderError);
    const orders = await this.assembleOrders(schema, result.orders);
    return { ...result, orders };
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

    const result = await getOrdersAdmin(this.pool, schema, {
      status,
      page,
      limit,
    }).catch(handleOrderError);
    const orders = await this.assembleOrders(schema, result.orders);
    return { ...result, orders };
  }

  async getOrderAdmin(
    ctx: Context<{ oid: string }, { user: UserMeta }>
  ) {
    const { oid } = ctx.params;
    const schema = await this.getSchema();

    const rawOrder = await getOrderById(this.pool, schema, oid)
      .catch(handleOrderError);
    const [assembled] = await this.assembleOrders(schema, [rawOrder]);
    return assembled;
  }

  async assembleOrders(
    schema: string,
    rawOrders: OrderRaw[],
  ): Promise<Order.OrderWithItems[]> {
    if (rawOrders.length === 0) return [];

    const client = this.pool;
    const exhibitionIds = [...new Set(rawOrders.map(o => o.exhibit_id))];
    const exhibitionMap = await getExhibitionsByIds(client, schema, exhibitionIds)
      .catch(handleExhibitionError);
    const sessionIds = [...new Set(rawOrders.map(o => o.session_id))];
    const sessionMap = await getSessionsByIds(client, schema, sessionIds)
      .catch(handleExhibitionError);
    const ticketCategoryIds = [...new Set(
      rawOrders.flatMap(o => o.items.map(i => i.ticket_category_id))
    )];
    const ticketCategoryMap = await getTicketCategoriesByIds(client, schema, ticketCategoryIds)
      .catch(handleExhibitionError);

    const orderIds = rawOrders.map(o => o.id);
    const invoiceMap = await getInvoicesByOrderIds(client, schema, orderIds);

    const outRefundNos = rawOrders
      .map(o => o.current_refund_out_refund_no)
      .filter((x): x is string => x !== null);
    const refundMap = await getRefundsByOutRefundNos(client, schema, outRefundNos);

    return rawOrders.map((order) => {
      const exhibition = exhibitionMap.get(order.exhibit_id)!;
      const session = sessionMap.get(order.session_id)!;
      return {
        ...order,
        exhibition: {
          id: exhibition.id,
          name: exhibition.name,
          description: exhibition.description,
          cover_url: exhibition.cover_url,
          location: exhibition.location,
          city: exhibition.city,
          venue_name: exhibition.venue_name,
          start_date: exhibition.start_date,
          end_date: exhibition.end_date,
        },
        session: {
          id: session.id,
          session_date: format(new Date(session.session_date), 'yyyy-MM-dd'),
          opening_time: exhibition.opening_time,
          closing_time: exhibition.closing_time,
          last_entry_time: exhibition.last_entry_time,
        },
        items: order.items.map(item => ({
          ...item,
          ticket_category_name: ticketCategoryMap.get(item.ticket_category_id)?.name ?? '',
        })),
        invoice: invoiceMap.get(order.id) ?? null,
        refund: order.current_refund_out_refund_no
          ? refundMap.get(order.current_refund_out_refund_no) ?? null
          : null,
      };
    });
  }

  async markOrderPaid(
    ctx: Context<{ oid: string }>
  ) {
    const { oid } = ctx.params;

    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    let res: { paid_at: Date } | null = null;
    try {
      await dbClient.query('BEGIN');
      res = await markOrderPaidData(dbClient, schema, oid);
      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
    await ctx.call('cr7.redemption.generateByOrder', { oid })
      .catch((error) => {
        this.logger.error(`Failed to generate redemption code for order ${oid}:`, error);
        throw error;
      });

    return res!;
  }

  async markOrderRefunded(
    ctx: Context<{ oid: string }>
  ) {
    const { oid } = ctx.params;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');
      const res = await markOrderRefundedDirectData(dbClient, schema, oid);
      await dbClient.query('COMMIT');
      return res;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleOrderError(error);
    } finally {
      dbClient.release();
    }
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
