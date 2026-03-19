import { Context, ServiceSchema } from "moleculer";
import type { Exhibition } from "@cr7/types";
import {
  createExhibition,
  getExhibitionById,
  getExhibitions,
  getTicketCategoriesByExhibitionId,
  getSessionsByExhibitionId,
  createTicketCategory,
  getSessionTicketCategoriesBySessionId,
  getSessionInventoryBySessionId,
  updateTicketCategoryInventoryMax
} from "../data/exhibition.js";
import { RC7BaseService } from "./cr7.base.js";

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
      params: {
        limit: { type: 'number', optional: true, default: 10, min: 1, max: 100, convert: true },
        offset: { type: 'number', optional: true, default: 0, min: 0, convert: true }
      },
      handler: this.listExhibitions
    },

    'exhibition.create': {
      rest: 'POST /',
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
        eid: 'string'
      },
      handler: this.getSessions
    },

    'exhibition.addTicketCategory': {
      rest: 'POST /:eid/tickets',
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

    'exhibition.getSessionTickets': {
      rest: 'GET /:eid/sessions/:sid/tickets',
      params: {
        eid: 'string',
        sid: 'string'
      },
      handler: this.getSessionTickets
    },

    'exhibition.updateTicketCategoryInventoryMax': {
      rest: 'PUT /:eid/sessions/tickets/:tid/inventory/max',
      params: {
        eid: 'string',
        tid: 'string',
        quantity: 'number|min:0'
      },
      handler: this.updateTicketCategoryInventoryMax
    }
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
    ctx: Context<{ eid: string }, { user: UserMeta }>
  ) {
    const { eid } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const sessions = await getSessionsByExhibitionId(client, schema, eid);

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
}

