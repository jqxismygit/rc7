import { Context, ServiceSchema } from 'moleculer';
import type { Exhibition, Order, Redeem } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  getRedemptionRowByCode,
  getRedemptionRowByOrderId,
  upsertRedemptionCodeByOrderId,
  redeemCode,
  RedeemDataError,
} from '../data/redeem.js';
import { getOrderById, getOrderByIdAdmin } from '../data/order.js';
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
  constructor(broker) {
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

    const order = await getOrderByIdAdmin(dbClient, schema, oid)
      .catch(handleOrderError);
    if (order.status !== 'PAID') {
      throw new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE');
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

    const order = await getOrderById(this.pool, schema, oid, uid)
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
        exhibit_id: order.exhibit_id,
        session_id: order.session_id,
        total_amount: order.total_amount,
        status: order.status,
      },
      items,
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

      const order = await getOrderByIdAdmin(dbClient, schema, codeRow.order_id)
        .catch(handleOrderError);
      const categories = await getTicketCategoriesByExhibitionId(dbClient, schema, order.exhibit_id);
      const items = buildItems(order.items, categories);

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