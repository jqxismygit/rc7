import { format, isAfter, isBefore } from 'date-fns';
import { Context, ServiceBroker, ServiceSchema } from 'moleculer';
import type { Exhibition, Order, Redeem } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  getRedemptionListByUser,
  getRedemptionRowByCode,
  getRedemptionRowByOrderId,
  upsertRedemptionCodeByOrderId,
  redeemCode,
  transferRedemptionCode,
  getTransfersByCode,
  RedeemDataError,
} from '../data/redeem.js';
import { getOrderById, getOrdersByIds, OrderDataError } from '../data/order.js';
import {
  getExhibitionById,
  getExhibitionsByIds,
  getSessionById,
  getSessionsByIds,
  getTicketCategoriesByExhibitionId,
} from '../data/exhibition.js';
import { handleExhibitionError, handleOrderError, handleRedeemError } from './errors.js';

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

    'redemption.getByCode': {
      rest: 'GET /redemptions/:code',
      roles: ['admin', 'operator'],
      params: {
        code: 'string',
      },
      handler: this.getByCode,
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

    'redemption.transfer': {
      rest: 'POST /transfer',
      params: {
        code: 'string',
      },
      handler: this.transfer,
    },

    'redemption.getTransfers': {
      rest: 'GET /:code/transfers',
      roles: ['admin'],
      params: {
        code: 'string',
      },
      handler: this.getTransfers,
    },
  };

  methods = {
    assembleRedemption: this.assembleRedemption,
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
      dbClient, schema, order.exhibit_id, order.id, order.user_id,
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

    const redemptionRow = await getRedemptionRowByOrderId(this.pool, schema, order.id)
      .catch(handleRedeemError);

    return this.assembleRedemption(schema, redemptionRow);
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
    const ordersById = await getOrdersByIds(this.pool, schema, orderIds)
      .catch(handleOrderError);

    const ticketCategoriesByExhibitionId = new Map<string, Exhibition.TicketCategory[]>();
    for (const order of ordersById.values()) {
      if (!ticketCategoriesByExhibitionId.has(order.exhibit_id)) {
        const categories = await getTicketCategoriesByExhibitionId(this.pool, schema, order.exhibit_id)
          .catch(handleRedeemError);
        ticketCategoriesByExhibitionId.set(order.exhibit_id, categories);
      }
    }

    const exhibitionById = await getExhibitionsByIds(
      this.pool,
      schema,
      [...new Set([...ordersById.values()].map(order => order.exhibit_id))],
    ).catch(handleRedeemError);
    const sessionById = await getSessionsByIds(
      this.pool,
      schema,
      [...new Set([...ordersById.values()].map(order => order.session_id))],
    ).catch(handleRedeemError);

    const redemptions = redemptionRows.redemptions.map((redemption) => {
      const order = ordersById.get(redemption.order_id);
      if (order === undefined) {
        return handleOrderError(new OrderDataError('Order not found', 'ORDER_NOT_FOUND'));
      }

      const categories = ticketCategoriesByExhibitionId.get(order.exhibit_id);
      if (categories === undefined) {
        return handleRedeemError(new RedeemDataError('Order has no redemption code', 'ORDER_NOT_REDEEMABLE'));
      }

      const exhibition = exhibitionById.get(order.exhibit_id);
      if (exhibition === undefined) {
        return handleRedeemError(new RedeemDataError('Exhibition not found', 'ORDER_NOT_REDEEMABLE'));
      }

      const session = sessionById.get(order.session_id);
      if (session === undefined) {
        return handleRedeemError(new RedeemDataError('Session not found', 'ORDER_NOT_REDEEMABLE'));
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
          total_amount: order.total_amount,
          status: order.status,
        },
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

  async getByCode(
    ctx: Context<{ code: string }>
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const { code } = ctx.params;
    const schema = await this.getSchema();
    const redemptionRow = await getRedemptionRowByCode(this.pool, schema, code)
      .catch(handleRedeemError);

    return this.assembleRedemption(schema, redemptionRow);
  }

  async assembleRedemption(
    schema: string,
    redemptionRow: Redeem.RedemptionCode
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const order = await getOrderById(this.pool, schema, redemptionRow.order_id)
      .catch(handleOrderError);
    const categories = await getTicketCategoriesByExhibitionId(this.pool, schema, order.exhibit_id)
      .catch(handleRedeemError);
    const items = buildItems(order.items, categories);
    const exhibition = await getExhibitionById(this.pool, schema, order.exhibit_id)
      .catch(handleRedeemError);
    const session = await getSessionById(this.pool, schema, order.session_id)
      .catch(handleRedeemError);

    return {
      ...redemptionRow,
      order: {
        id: order.id,
        user_id: order.user_id,
        source: order.source,
        exhibit_id: order.exhibit_id,
        session_id: order.session_id,
        total_amount: order.total_amount,
        status: order.status,
      },
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
      items,
    };
  }

  async redeem(
    ctx: Context<Redeem.RedeemRequest & { eid: string }, { user: UserMeta }>
  ): Promise<Redeem.RedemptionCodeWithOrder> {
    const { eid, code } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const dbClient = this.pool;

    const redemption = await getRedemptionRowByCode(dbClient, schema, code)
      .catch(handleRedeemError);
    if (redemption.exhibit_id !== eid) {
      handleRedeemError(
        new RedeemDataError('Redemption code not found', 'REDEMPTION_NOT_FOUND')
      );
    }
    const order = await getOrderById(dbClient, schema, redemption.order_id)
      .catch(handleOrderError);

    if (
      order.status === 'REFUND_REQUESTED'
      || order.status === 'REFUND_PROCESSING'
      || order.status === 'REFUNDED'
    ) {
      handleRedeemError(
        new RedeemDataError('Order is in refund flow', 'ORDER_REFUND_IN_PROGRESS')
      );
    }
    if (redemption.status === 'REDEEMED') {
      handleRedeemError(
        new RedeemDataError('Redemption code already redeemed', 'REDEMPTION_ALREADY_REDEEMED')
      );
    }

    const now = new Date();
    if (isAfter(now, new Date(redemption.valid_until))) {
      handleRedeemError(
        new RedeemDataError('Redemption code expired', 'REDEMPTION_EXPIRED')
      );
    }
    if (isBefore(now, new Date(redemption.valid_from))) {
      handleRedeemError(
        new RedeemDataError('Redemption code not yet valid', 'REDEMPTION_NOT_YET_VALID')
      );
    }

    const categories = await getTicketCategoriesByExhibitionId(dbClient, schema, order.exhibit_id)
      .catch(handleExhibitionError);
    const items = buildItems(order.items, categories);

    if (order.source === 'CTRIP') {
      await ctx.call('xiecheng.notifyOrderConsumed', { oid: order.id });
    }

    if (order.source === 'MOP') {
      await ctx.call('mop.notifyOrderConsumed', { oid: order.id });
    }

    if (order.source === 'DAMAI') {
      const redeemed_at = redemption.redeemed_at ?? new Date();
      await ctx.call('damai.notifyOrderConsumed', { oid: order.id, redeemed_at });
    }

    const updatedRow = await redeemCode(dbClient, schema, code, uid)
      .catch(handleRedeemError);

    const exhibition = await getExhibitionById(this.pool, schema, order.exhibit_id)
      .catch(handleExhibitionError);
    const session = await getSessionById(dbClient, schema, order.session_id)
      .catch(handleExhibitionError);

    const res: Redeem.RedemptionCodeWithOrder = {
      ...updatedRow,
      order: {
        id: order.id,
        user_id: order.user_id,
        source: order.source,
        exhibit_id: order.exhibit_id,
        session_id: order.session_id,
        total_amount: order.total_amount,
        status: order.status,
      },
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
      items,
    };

    return res;
  }

  async transfer(
    ctx: Context<{ code: string }, { user: UserMeta }>
  ): Promise<null> {
    const { code } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const client = this.pool;

    const redemption = await getRedemptionRowByCode(client, schema, code)
      .catch(handleRedeemError);
    if (redemption.owner_user_id === uid) {
      handleRedeemError(
        new RedeemDataError(
          'Redemption code already owned by this user',
          'REDEMPTION_ALREADY_OWNED'
        )
      );
    }

    const ownerId = redemption.owner_user_id;
    await transferRedemptionCode(client, schema, code, uid, ownerId)
      .catch(handleRedeemError);

    Object.assign(ctx.meta, { $statusCode: 204 });
    return null;
  }

  async getTransfers(
    ctx: Context<{ code: string }>
  ): Promise<Redeem.RedemptionTransferListResult> {
    const { code } = ctx.params;
    const schema = await this.getSchema();

    await getRedemptionRowByCode(this.pool, schema, code)
      .catch(handleRedeemError);

    const transfers = await getTransfersByCode(this.pool, schema, code)
      .catch(handleRedeemError);

    return { transfers };
  }
}
