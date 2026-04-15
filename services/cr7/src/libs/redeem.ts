import { Context, ServiceBroker, ServiceSchema } from 'moleculer';
import type { Exhibition, Order, Redeem } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  getRedemptionListByUser,
  getRedemptionRowByCode,
  getRedemptionRowByOrderId,
  upsertRedemptionCodeByOrderId,
  redeemCode,
  RedeemDataError,
} from '../data/redeem.js';
import { getOrderById, getOrdersByIdsForUser, OrderDataError } from '../data/order.js';
import { getSessionById, getTicketCategoriesByExhibitionId } from '../data/exhibition.js';
import { handleOrderError, handleRedeemError } from './errors.js';

interface UserMeta {
  uid: string;
}

function buildItems(
  orderItems: Order.OrderItem[],
  categories: Exhibition.TicketCategory[],
): Redeem.RedemptionCodeWithOrder['items'] {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  return orderItems.map(item => ({
    id: item.id,
    ticket_category_id: item.ticket_category_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    category_name: categoryMap.get(item.ticket_category_id)?.name ?? '',
  }));
}

function computeValidDurationDays(
  orderItems: Order.OrderItem[],
  categories: Exhibition.TicketCategory[],
): number {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  return Math.max(1, ...orderItems.map(item => categoryMap.get(item.ticket_category_id)?.valid_duration_days ?? 1));
}

export class RedemptionService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);
  }

  actions_redemption: ServiceSchema['actions'] = {
    'redemption.generateByOrder': {
      params: {
        oid: 'string',
      },
      handler: this.generateByOrder,
    },

    'redemption.getByOrder': {
      rest: 'GET /:oid/redemption',
      params: {
        oid: 'string',
      },
      handler: this.getByOrder,
    },

    'redemption.listByUser': {
      rest: 'GET /redemptions',
      params: {
        status: {
          type: 'enum',
          values: ['UNREDEEMED', 'REDEEMED'],
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
      handler: this.listByUser,
    },

    'redemption.redeem': {
      rest: 'POST /redeem',
      roles: ['admin', 'operator'],
      params: {
        eid: 'string',
        code: 'string',
        quantity: {
          type: 'number',
          integer: true,
          positive: true,
          optional: true,
        },
      },
      handler: this.redeem,
    },
  };

  async generateByOrder(
    ctx: Context<{ oid: string }>
  ): Promise<void> {
    const { oid } = ctx.params;
    const schema = await this.getSchema();
    const dbClient = this.pool;

    const order = await getOrderById(dbClient, schema, oid)
      .catch(handleOrderError);
    if (order.status !== 'PAID') {
      throw new RedeemDataError(
        'Order has no redemption code',
        'ORDER_NOT_REDEEMABLE',
        { order_status: order.status }
      );
    }

    const session = await getSessionById(dbClient, schema, order.session_id)
      .catch(handleRedeemError);
    const categories = await getTicketCategoriesByExhibitionId(dbClient, schema, order.exhibit_id)
      .catch(handleRedeemError);
    const items = buildItems(order.items, categories);
    const validDurationDays = computeValidDurationDays(order.items, categories);
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);

    await upsertRedemptionCodeByOrderId(
      dbClient, schema, order.exhibit_id, order.id,
      quantity, session.session_date, validDurationDays,
    )
      .catch(handleRedeemError);
  }

  async getByOrder(
    ctx: Context<{ oid: string }, { user: UserMeta }>
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();

    const order = await getOrderById(this.pool, schema, oid)
      .then((result) => {
        if (result.user_id !== uid) {
          throw new OrderDataError('Order not found', 'ORDER_NOT_FOUND');
        }

        return result;
      })
      .catch(handleOrderError);

    if (order.status !== 'PAID') {
      handleRedeemError(new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE'));
    }

    const categories = await getTicketCategoriesByExhibitionId(this.pool, schema, order.exhibit_id)
      .catch(handleRedeemError);
    const items = buildItems(order.items, categories);
    const redemptionRow = await getRedemptionRowByOrderId(this.pool, schema, order.id)
      .catch(handleRedeemError);

    return {
      ...redemptionRow,
      order: {
        id: order.id,
        user_id: order.user_id,
        source: order.source,
        exhibit_id: order.exhibit_id,
        session_id: order.session_id,
        session_date: order.session_date,
        total_amount: order.total_amount,
        status: order.status,
      },
      items,
    };
  }

  async listByUser(
    ctx: Context<{
      status?: Redeem.RedemptionStatus;
      page?: number;
      limit?: number;
    }, { user: UserMeta }>
  ): Promise<Redeem.RedemptionCodeListResult> {
    const { uid } = ctx.meta.user;
    const {
      status,
      page = 1,
      limit = 20,
    } = ctx.params;
    const schema = await this.getSchema();

    const redemptionRows = await getRedemptionListByUser(this.pool, schema, uid, {
      status,
      page,
      limit,
    }).catch(handleRedeemError);

    const orderIds = redemptionRows.redemptions.map(redemption => redemption.order_id);
    const ordersById = await getOrdersByIdsForUser(this.pool, schema, uid, orderIds)
      .catch(handleOrderError);

    const ticketCategoriesByExhibitionId = new Map<string, Exhibition.TicketCategory[]>();
    for (const order of ordersById.values()) {
      if (ticketCategoriesByExhibitionId.has(order.exhibit_id)) {
        continue;
      }

      const categories = await getTicketCategoriesByExhibitionId(this.pool, schema, order.exhibit_id)
        .catch(handleRedeemError);
      ticketCategoriesByExhibitionId.set(order.exhibit_id, categories);
    }

    const redemptions = redemptionRows.redemptions.map((redemption) => {
      const order = ordersById.get(redemption.order_id);
      if (order === undefined) {
        return handleOrderError(new OrderDataError('Order not found', 'ORDER_NOT_FOUND'));
      }

      const categories = ticketCategoriesByExhibitionId.get(order.exhibit_id);
      if (categories === undefined) {
        return handleRedeemError(new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE'));
      }

      const items = buildItems(order.items, categories);

      return {
        ...redemption,
        order: {
          id: order.id,
          user_id: order.user_id,
          source: order.source,
          exhibit_id: order.exhibit_id,
          session_id: order.session_id,
          session_date: order.session_date,
          total_amount: order.total_amount,
          status: order.status,
        },
        items,
      };
    });

    return {
      redemptions,
      total: redemptionRows.total,
      page: redemptionRows.page,
      limit: redemptionRows.limit,
    };
  }

  async redeem(
    ctx: Context<Redeem.RedeemRequest & { eid: string }, { user: UserMeta }>
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const { eid, code } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');

      const codeRow = await getRedemptionRowByCode(dbClient, schema, eid, code);

      const order = await getOrderById(dbClient, schema, codeRow.order_id)
        .catch(handleOrderError);
      const categories = await getTicketCategoriesByExhibitionId(dbClient, schema, order.exhibit_id);
      const items = buildItems(order.items, categories);

      if (order.source === 'CTRIP') {
        await ctx.call('xiecheng.notifyOrderConsumed', { oid: order.id });
      }

      if (order.source === 'MOP') {
        await ctx.call('mop.notifyOrderConsumed', { oid: order.id });
      }

      if (order.source === 'DAMAI') {
        const redeemed_at = codeRow.redeemed_at ?? new Date();
        await ctx.call('damai.notifyOrderConsumed', { oid: order.id, redeemed_at });
      }

      const redemption = await redeemCode(dbClient, schema, eid, code, uid, order, items);

      await dbClient.query('COMMIT');
      return redemption;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleRedeemError(error);
    } finally {
      dbClient.release();
    }
  }
}