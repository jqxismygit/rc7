import { Context, Errors, ServiceSchema } from "moleculer";
import type { Exhibition } from "@cr7/types";
import {
  createExhibition,
  getExhibitionById,
  getExhibitions,
  getTicketCategoryById,
  getTicketCategoriesByExhibitionId,
  getSessionsByExhibitionId,
  createTicketCategory,
  updateExhibition,
  updateTicketCategoryOtaXcOptionId,
  listSessionInventoryByTicketAndDateRange,
  getSessionTicketCategoriesBySessionId,
  getSessionInventoryBySessionId,
  updateTicketCategoryInventoryMax
} from "../data/exhibition.js";
import { handleExhibitionError } from './errors.js';
import { RC7BaseService } from "./cr7.base.js";

const { MoleculerClientError } = Errors;

const EXHIBITION_UPDATE_FIELDS = [
  'name',
  'description',
  'opening_time',
  'closing_time',
  'last_entry_time',
  'location',
  'cover_url',
] as const;

interface UserMeta {
  uid: string;
}

/**
 * ExhibitionService
 * 展览活动相关服务，提供展览和票种管理功能
 */
export class ExhibitionService extends RC7BaseService {
  constructor(broker) {
    super(broker);
  }

  actions_exhibition: ServiceSchema['actions'] = {
    'exhibition.list': {
      rest: 'GET /',
      roles: ['admin'],
      params: {
        limit: { type: 'number', optional: true, default: 10, min: 1, max: 100, convert: true },
        offset: { type: 'number', optional: true, default: 0, min: 0, convert: true }
      },
      handler: this.listExhibitions
    },

    'exhibition.create': {
      rest: 'POST /',
      roles: ['admin'],
      params: {
        name: 'string',
        description: 'string',
        start_date: 'string',
        end_date: 'string',
        opening_time: 'string',
        closing_time: 'string',
        last_entry_time: 'string',
        location: 'string'
      },
      handler: this.createExhibition
    },

    'exhibition.get': {
      rest: 'GET /:eid',
      params: {
        eid: 'string'
      },
      handler: this.getExhibition
    },

    'exhibition.getTicketCategories': {
      rest: 'GET /:eid/tickets',
      params: {
        eid: 'string'
      },
      handler: this.getTicketCategories
    },

    'exhibition.getSessions': {
      rest: 'GET /:eid/sessions',
      params: {
        eid: 'string',
        start_session_date: {
          type: 'date',
          convert: true,
          optional: true,
        },
        end_session_date: {
          type: 'date',
          convert: true,
          optional: true,
        },
      },
      handler: this.getSessions
    },

    'exhibition.addTicketCategory': {
      rest: 'POST /:eid/tickets',
      roles: ['admin'],
      params: {
        eid: 'string',
        name: 'string',
        price: 'number',
        valid_duration_days: 'number',
        refund_policy: 'string',
        admittance: 'number'
      },
      handler: this.addTicketCategory
    },

    'exhibition.update': {
      rest: 'PATCH /:eid',
      roles: ['admin'],
      params: {
        eid: 'string',
        name: { type: 'string', optional: true, min: 1 },
        description: { type: 'string', optional: true },
        opening_time: { type: 'string', optional: true },
        closing_time: { type: 'string', optional: true },
        last_entry_time: { type: 'string', optional: true },
        location: { type: 'string', optional: true },
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.updateExhibition
    },

    'exhibition.getSessionTickets': {
      rest: 'GET /:eid/sessions/:sid/tickets',
      params: {
        eid: 'string',
        sid: 'string'
      },
      handler: this.getSessionTickets
    },

    'exhibition.updateTicketCategoryInventoryMax': {
      roles: ['admin'],
      rest: 'PUT /:eid/sessions/tickets/:tid/inventory/max',
      params: {
        eid: 'string',
        tid: 'string',
        quantity: 'number|min:0'
      },
      handler: this.updateTicketCategoryInventoryMax
    },

    'exhibition.getTicket': {
      visibility: 'protected',
      params: {
        eid: 'string',
        tid: 'string',
      },
      handler: this.getTicket,
    },

    'exhibition.updateTicketXcOptionId': {
      visibility: 'protected',
      params: {
        eid: 'string',
        tid: 'string',
        ota_option_id: 'string|min:1',
      },
      handler: this.updateTicketXcOptionId,
    },

    'exhibition.listSessionInventoryByTicketAndDateRange': {
      visibility: 'protected',
      params: {
        eid: 'string',
        tid: 'string',
        start_session_date: {
          type: 'date',
          convert: true,
        },
        end_session_date: {
          type: 'date',
          convert: true,
        },
      },
      handler: this.listSessionInventoryByTicketAndDateRange,
    },
  }

  async createExhibition(
    ctx: Context<Omit<Exhibition.Exhibition, 'id' | 'created_at' | 'updated_at'>, { user: UserMeta }>
  ) {
    const client = this.pool;
    const schema = await this.getSchema();

    const exhibition = await createExhibition(client, schema, ctx.params);

    return exhibition;
  }

  async listExhibitions(
    ctx: Context<{ limit?: number; offset?: number }, { user: UserMeta }>
  ) {
    const { limit = 10, offset = 0 } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const { exhibitions, total } = await getExhibitions(client, schema, limit, offset);

    return { data: exhibitions, total, limit, offset };
  }

  async getExhibition(
    ctx: Context<{ eid: string }, { user: UserMeta }>
  ) {
    const { eid } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const exhibition = await getExhibitionById(client, schema, eid);

    return exhibition;
  }

  async getTicketCategories(
    ctx: Context<{ eid: string }, { user: UserMeta }>
  ) {
    const { eid } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const ticket_categories = await getTicketCategoriesByExhibitionId(client, schema, eid);

    return ticket_categories;
  }

  async getSessions(
    ctx: Context<{
      eid: string;
      start_session_date?: Date;
      end_session_date?: Date;
    }, { user: UserMeta }>
  ) {
    const { eid, start_session_date, end_session_date } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const sessions = await getSessionsByExhibitionId(
      client,
      schema,
      eid,
      start_session_date,
      end_session_date,
    );

    return sessions;
  }

  async addTicketCategory(
    ctx: Context<
      { eid: string } & Omit<Exhibition.TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>,
      { user: UserMeta }
    >
  ) {
    const { eid, ...category } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const ticketCategory = await createTicketCategory(client, schema, eid, category);

    return ticketCategory;
  }

  async updateExhibition(
    ctx: Context<{ eid: string } & Exhibition.ExhibitionPatch, { user: UserMeta }>
  ) {
    const { eid, ...patch } = ctx.params;

    if ('start_date' in patch || 'end_date' in patch) {
      throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
    }


    if (EXHIBITION_UPDATE_FIELDS.every(field => Object.hasOwn(patch, field) === false)) {
      throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
    }

    const client = this.pool;
    const schema = await this.getSchema();

    const exhibition = await updateExhibition(client, schema, eid, patch)
      .catch(handleExhibitionError);

    return exhibition;
  }

  async getSessionTickets(
    ctx: Context<{ eid: string; sid: string }, { user: UserMeta }>
  ) {
    const { eid, sid } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const tickets = await getSessionTicketCategoriesBySessionId(client, schema, eid, sid);
    const inventory = await getSessionInventoryBySessionId(client, schema, eid, sid);

    const quantityByTicketCategoryId = new Map(
      inventory.map(item => [item.ticket_category_id, item.quantity])
    );

    return tickets.map(ticket => ({
      ...ticket,
      session_id: sid,
      quantity: quantityByTicketCategoryId.get(ticket.id) ?? 0
    }));
  }

  async updateTicketCategoryInventoryMax(
    ctx: Context<
      { eid: string; tid: string; quantity: number },
      { user: UserMeta, $statusCode?: number }
    >
  ) {
    const { eid, tid, quantity } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    await updateTicketCategoryInventoryMax(client, schema, eid, tid, quantity);

    ctx.meta.$statusCode = 204;
  }

  async getTicket(ctx: Context<{ eid: string; tid: string }>) {
    const { eid, tid } = ctx.params;
    const schema = await this.getSchema();
    return getTicketCategoryById(this.pool, schema, eid, tid)
    .catch(handleExhibitionError);
  }

  async updateTicketXcOptionId(ctx: Context<{ eid: string; tid: string; ota_option_id: string }>) {
    const { eid, tid, ota_option_id } = ctx.params;
    const schema = await this.getSchema();
    return updateTicketCategoryOtaXcOptionId(this.pool, schema, eid, tid, ota_option_id)
    .catch(handleExhibitionError);
  }

  async listSessionInventoryByTicketAndDateRange(
    ctx: Context<{ eid: string; tid: string; start_session_date: Date; end_session_date: Date }>
  ) {
    const { eid, tid, start_session_date, end_session_date } = ctx.params;
    const schema = await this.getSchema();
    return listSessionInventoryByTicketAndDateRange(this.pool, schema, eid, tid, start_session_date, end_session_date);
  }
}

