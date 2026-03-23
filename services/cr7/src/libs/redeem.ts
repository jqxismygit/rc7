import { Context, Errors, ServiceSchema } from 'moleculer';
import type { Exhibition, Order, Redeem } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  findRedemptionByCode,
  getOrCreateRedemptionByOrderId,
  redeemCode,
  RedeemDataError,
} from '../data/redeem.js';
import { getOrderById, getOrderByIdAdmin, OrderDataError } from '../data/order.js';
import { getSessionById, getTicketCategoriesByExhibitionId } from '../data/exhibition.js';

interface UserMeta {
  uid: string;
}

const { MoleculerClientError } = Errors;

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

function handleRedeemError(error: unknown): never {
  if (error instanceof OrderDataError) {
    if (error.code === 'ORDER_NOT_FOUND') {
      throw new MoleculerClientError('资源不存在', 404, error.code);
    }
    throw error;
  }

  if ((error instanceof RedeemDataError) === false) {
    throw error;
  }

  if (error.code === 'ORDER_NOT_FOUND' || error.code === 'REDEMPTION_NOT_FOUND') {
    throw new MoleculerClientError('资源不存在', 404, error.code);
  }

  if (error.code === 'ORDER_NOT_REDEEMABLE') {
    throw new MoleculerClientError('订单未支付或无核销码', 410, error.code);
  }

  if (
    error.code === 'REDEMPTION_ALREADY_REDEEMED'
    || error.code === 'REDEMPTION_EXPIRED'
  ) {
    throw new MoleculerClientError('核销码不可用', 409, error.code);
  }

  throw new MoleculerClientError('核销服务错误', 500, 'REDEEM_ERROR');
}

export class RedemptionService extends RC7BaseService {
  constructor(broker) {
    super(broker);
  }

  actions_redemption: ServiceSchema['actions'] = {
    'redemption.getByOrder': {
      rest: 'GET /:oid/redemption',
      params: {
        oid: 'string',
      },
      handler: this.getByOrder,
    },

    'redemption.redeem': {
      rest: 'POST /redeem',
      roles: ['admin'],
      params: {
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

  async getByOrder(
    ctx: Context<{ oid: string }, { user: UserMeta }>
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');

      const order = await getOrderById(dbClient, schema, oid, uid);
      if (order.status !== 'PAID') {
        throw new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE');
      }

      const session = await getSessionById(dbClient, schema, order.session_id);
      const categories = await getTicketCategoriesByExhibitionId(dbClient, schema, order.exhibit_id);
      const items = buildItems(order.items, categories);
      const validDurationDays = computeValidDurationDays(order.items, categories);

      const redemption = await getOrCreateRedemptionByOrderId(
        dbClient, schema, order, session.session_date, items, validDurationDays,
      );

      await dbClient.query('COMMIT');
      return redemption;
    } catch (error) {
      await dbClient.query('ROLLBACK');
      return handleRedeemError(error);
    } finally {
      dbClient.release();
    }
  }

  async redeem(
    ctx: Context<Redeem.RedeemRequest, { user: UserMeta }>
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const { code } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = await this.pool.connect();

    try {
      await dbClient.query('BEGIN');

      const codeRow = await findRedemptionByCode(dbClient, schema, code);
      if (codeRow === null) {
        throw new RedeemDataError('Redemption code not found', 'REDEMPTION_NOT_FOUND');
      }

      const order = await getOrderByIdAdmin(dbClient, schema, codeRow.order_id);
      const categories = await getTicketCategoriesByExhibitionId(dbClient, schema, order.exhibit_id);
      const items = buildItems(order.items, categories);

      const redemption = await redeemCode(dbClient, schema, code, uid, order, items);

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