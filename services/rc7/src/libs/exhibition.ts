import { Context, ServiceSchema } from "moleculer";
import type { Exhibition } from "@rc7/types";
import {
  createExhibition,
  getExhibitionById,
  getTicketCategoriesByExhibitionId,
  createTicketCategory
} from "../data/exhibition.js";
import { RC7BaseService } from "./rc7.base.js";

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
}
