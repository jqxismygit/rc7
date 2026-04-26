import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { Context, ServiceBroker, ServiceSchema } from 'moleculer';
import type { Cdkey, Redeem } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import {
  CdkeyDataError,
  type CdkeyBatchRecord,
  type CdkeyRecord,
  createCdkeyBatch,
  getCdkeyBatchById,
  getCdkeyByCode,
  listCdkeyBatches,
  listCdkeysByBatch,
  redeemCdkey,
} from '../data/cdkey.js';
import { reserveSessionInventories } from '../data/order.js';
import { createRedemptionCodeByCdkey } from '../data/redeem.js';
import {
  getExhibitionsByIds,
  getSessionById,
  getSessionsByIds,
  getTicketCategoryById,
  getTicketCategoriesByIds,
} from '../data/exhibition.js';
import { getUserProfilesByIds } from '../data/user.js';
import { handleCdkeyError, handleExhibitionError, handleOrderError } from './errors.js';

interface UserMeta {
  uid: string;
}

function toCdkeyStatus(redeemedAt: string | null): Cdkey.CdkeyStatus {
  return redeemedAt === null ? 'UNUSED' : 'USED';
}

function assembleCdkeyBatchRow(
  exhibitionById: Map<string, { id: string; name: string }>,
  ticketCategoryById: Map<string, { id: string; name: string; list_price: number }>,
  row: CdkeyBatchRecord,
): Cdkey.CdkeyBatch {
  const exhibition = exhibitionById.get(row.exhibit_id);
  const ticketCategory = ticketCategoryById.get(row.ticket_category_id);

  if (exhibition === undefined || ticketCategory === undefined) {
    throw new Error('Failed to assemble cdkey batch due to missing related data');
  }

  return {
    id: row.id,
    exhibition: {
      id: exhibition.id,
      name: exhibition.name,
    },
    name: row.name,
    ticket_category: {
      id: ticketCategory.id,
      name: ticketCategory.name,
      list_price: ticketCategory.list_price,
    },
    redeem_quantity: row.redeem_quantity,
    quantity: row.quantity,
    used_count: row.used_count,
    redeem_valid_until: row.redeem_valid_until,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function assembleCdkeyRow(
  exhibitionById: Map<string, { id: string; name: string }>,
  ticketCategoryById: Map<string, { id: string; name: string; list_price: number }>,
  sessionById: Map<string, { id: string; session_date: Date | string }>,
  userById: Map<string, { id: string; phone: string | null }>,
  row: CdkeyRecord,
): Cdkey.Cdkey {
  const exhibition = exhibitionById.get(row.exhibit_id);
  const ticketCategory = ticketCategoryById.get(row.ticket_category_id);

  if (exhibition === undefined || ticketCategory === undefined) {
    throw new Error('Failed to assemble cdkey due to missing related data');
  }

  const redeemedSession = row.redeemed_session_id === null
    ? null
    : (() => {
        const session = sessionById.get(row.redeemed_session_id as string);
        if (session === undefined) {
          throw new Error('Failed to assemble cdkey due to missing redeemed session');
        }

        return {
          id: session.id,
          session_date: format(new Date(session.session_date), 'yyyy-MM-dd'),
        };
      })();

  const redeemedBy = row.redeemed_by === null
    ? null
    : (() => {
        const user = userById.get(row.redeemed_by as string);
        if (user === undefined) {
          throw new Error('Failed to assemble cdkey due to missing redeemed user');
        }

        return {
          id: user.id,
          phone: user.phone ?? '',
        };
      })();

  return {
    id: row.id,
    batch_id: row.batch_id,
    exhibition: {
      id: exhibition.id,
      name: exhibition.name,
    },
    ticket_category: {
      id: ticketCategory.id,
      name: ticketCategory.name,
      list_price: ticketCategory.list_price,
    },
    code: row.code,
    status: toCdkeyStatus(row.redeemed_at),
    redeem_quantity: row.redeem_quantity,
    redeem_valid_until: row.redeem_valid_until,
    redeemed_session: redeemedSession,
    redeemed_by: redeemedBy,
    redeemed_at: row.redeemed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class CdkeyService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);
  }

  actions_cdkey: ServiceSchema['actions'] = {
    'cdkey.createBatch': {
      roles: ['admin'],
      params: {
        eid: 'uuid',
        name: { type: 'string', trim: true, min: 1 },
        ticket_category_id: 'uuid',
        redeem_quantity: {
          type: 'number',
          integer: true,
          positive: true,
        },
        quantity: {
          type: 'number',
          integer: true,
          positive: true,
        },
        redeem_valid_until: {
          type: 'date',
          convert: true,
        },
      },
      handler: this.createBatch,
    },

    'cdkey.listBatches': {
      roles: ['admin'],
      params: {
        eid: 'uuid',
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
      handler: this.listBatches,
    },

    'cdkey.listByBatch': {
      roles: ['admin'],
      params: {
        bid: 'uuid',
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
      handler: this.listByBatch,
    },

    'cdkey.getByCode': {
      roles: ['admin'],
      params: {
        code: 'string',
      },
      handler: this.getByCode,
    },

    'cdkey.redeem': {
      params: {
        sid: 'uuid',
        code: 'string',
      },
      handler: this.redeem,
    },
  };

  methods = {
    assembleCdkeys: this.assembleCdkeys,
    assembleBatch: this.assembleBatch,
  };

  async createBatch(
    ctx: Context<{
      eid: string;
      name: string;
      ticket_category_id: string;
      redeem_quantity: number;
      quantity: number;
      redeem_valid_until: Date;
    }, { user: UserMeta; $statusCode?: number }>,
  ): Promise<Cdkey.CreateCdkeyBatchResult> {
    const { uid } = ctx.meta.user;
    const {
      eid,
      name,
      ticket_category_id: ticketCategoryId,
      redeem_quantity: redeemQuantity,
      quantity,
      redeem_valid_until: redeemValidUntil,
    } = ctx.params;
    const schema = await this.getSchema();

    await getTicketCategoryById(this.pool, schema, eid, ticketCategoryId)
      .catch(handleExhibitionError);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await createCdkeyBatch(client, schema, {
        exhibit_id: eid,
        name,
        ticket_category_id: ticketCategoryId,
        redeem_quantity: redeemQuantity,
        quantity,
        redeem_valid_until: redeemValidUntil,
        created_by: uid,
      }).catch(handleCdkeyError);
      await client.query('COMMIT');
      ctx.meta.$statusCode = 201;
      return { id: result.batch.id };
    } catch (error) {
      await client.query('ROLLBACK');
      return handleCdkeyError(error);
    } finally {
      client.release();
    }
  }

  async listBatches(
    ctx: Context<{
      eid: string;
      page?: number;
      limit?: number;
    }>,
  ): Promise<Cdkey.CdkeyBatchListResult> {
    const { eid, page = 1, limit = 20 } = ctx.params;
    const schema = await this.getSchema();
    const rows = await listCdkeyBatches(this.pool, schema, eid, { page, limit })
      .catch(handleCdkeyError);

    const batches = await this.assembleBatch(schema, rows.batches);

    return {
      batches,
      total: rows.total,
      page: rows.page,
      limit: rows.limit,
    };
  }

  async listByBatch(
    ctx: Context<{
      bid: string;
      page?: number;
      limit?: number;
    }>,
  ): Promise<Cdkey.CdkeyListResult> {
    const { bid, page = 1, limit = 20 } = ctx.params;
    const schema = await this.getSchema();

    await getCdkeyBatchById(this.pool, schema, bid)
      .catch(handleCdkeyError);

    const rows = await listCdkeysByBatch(this.pool, schema, bid, { page, limit })
      .catch(handleCdkeyError);

    const codes = await this.assembleCdkeys(schema, rows.codes);

    return {
      codes,
      total: rows.total,
      page: rows.page,
      limit: rows.limit,
    };
  }

  async getByCode(
    ctx: Context<{ code: string }>,
  ): Promise<Cdkey.Cdkey> {
    const { code } = ctx.params;
    const schema = await this.getSchema();
    const row = await getCdkeyByCode(this.pool, schema, code)
      .catch(handleCdkeyError);

    const [res] = await this.assembleCdkeys(schema, [row]);
    return res;
  }

  async redeem(
    ctx: Context<{
      sid: string;
      code: string;
    }, { user: UserMeta }>,
  ): Promise<Redeem.RedemptionCodeWithCDKey> {
    const { sid, code } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const cdkey = await getCdkeyByCode(client, schema, code)
        .catch(handleCdkeyError);

      if (cdkey.redeemed_at !== null) {
        throw new CdkeyDataError('CDKEY already used', 'CDKEY_ALREADY_USED');
      }

      const session = await getSessionById(client, schema, sid)
        .catch(handleExhibitionError);

      if (session.exhibit_id !== cdkey.exhibit_id) {
        throw new CdkeyDataError('Session not found', 'CDKEY_SESSION_NOT_FOUND');
      }

      const redeemValidUntil = parseISO(cdkey.redeem_valid_until);
      const sessionDate = startOfDay(new Date(session.session_date));
      if (isBefore(redeemValidUntil, sessionDate)) {
        throw new CdkeyDataError('CDKEY expired', 'CDKEY_EXPIRED');
      }

      await reserveSessionInventories(client, schema, {
        session_id: sid,
        items: [{
          ticket_category_id: cdkey.ticket_category_id,
          quantity: cdkey.redeem_quantity,
        }],
      }).catch(handleOrderError);

      const redeemedCdkey = await redeemCdkey(client, schema, {
        code,
        sid,
        redeemed_by: uid,
      }).catch(handleCdkeyError);

      if (redeemedCdkey === null) {
        throw new CdkeyDataError('CDKEY already used', 'CDKEY_ALREADY_USED');
      }

      const redemptionRow = await createRedemptionCodeByCdkey(client, schema, {
        exhibit_id: redeemedCdkey.exhibit_id,
        cdkey: redeemedCdkey.code,
        session_id: sid,
        owner_user_id: uid,
        quantity: redeemedCdkey.redeem_quantity,
        session_date: new Date(session.session_date),
      }).catch(handleCdkeyError);

      await client.query('COMMIT');
      const [res] = await this.assembleRedemption(schema, [redemptionRow]) as Redeem.RedemptionCodeWithCDKey[];
      return res;
    } catch (error) {
      await client.query('ROLLBACK');
      return handleCdkeyError(error);
    } finally {
      client.release();
    }
  }

  async assembleBatch(
    schema: string,
    batches: CdkeyBatchRecord[],
  ): Promise<Cdkey.CdkeyBatch[]> {
    const exhibitionIds = new Set<string>();
    const ticketCategoryIds = new Set<string>();
    for (const batch of batches) {
      exhibitionIds.add(batch.exhibit_id);
      ticketCategoryIds.add(batch.ticket_category_id);
    }

    const exhibitionById = await getExhibitionsByIds(this.pool, schema, [...exhibitionIds])
      .catch(handleExhibitionError);
    const ticketCategoryById = await getTicketCategoriesByIds(this.pool, schema, [...ticketCategoryIds])
      .catch(handleExhibitionError);

    return batches.map(batch => assembleCdkeyBatchRow(exhibitionById, ticketCategoryById, batch));
  }

  async assembleCdkeys(
    schema: string,
    codes: CdkeyRecord[],
  ): Promise<Cdkey.Cdkey[]> {
    const client = this.pool;

    const exhibitionIds = new Set<string>();
    const ticketCategoryIds = new Set<string>();
    const sessionIds = new Set<string>();
    const userIds = new Set<string>();
    for (const code of codes) {
      exhibitionIds.add(code.exhibit_id);
      ticketCategoryIds.add(code.ticket_category_id);
      if (code.redeemed_session_id !== null) {
        sessionIds.add(code.redeemed_session_id);
      }
      if (code.redeemed_by !== null) {
        userIds.add(code.redeemed_by);
      }
    }

    const exhibitionById = await getExhibitionsByIds(client, schema, [...exhibitionIds])
      .catch(handleExhibitionError);
    const ticketCategoryById = await getTicketCategoriesByIds(client, schema, [...ticketCategoryIds])
      .catch(handleExhibitionError);
    const sessionById = await getSessionsByIds(client, schema, [...sessionIds])
      .catch(handleExhibitionError);
    const userById = await getUserProfilesByIds(client, schema, [...userIds]);

    return codes.map(code => assembleCdkeyRow(
      exhibitionById,
      ticketCategoryById,
      sessionById,
      userById,
      code,
    ));
  }
}
