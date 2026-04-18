import { format, isBefore, parse, subMinutes } from 'date-fns';
import { Context, Errors, ServiceBroker, ServiceSchema } from "moleculer";
import type { Exhibition } from "@cr7/types";
import {
  createExhibition,
  getExhibitionById,
  getExhibitions,
  getSessionById,
  getTicketCategoryById,
  getTicketCategoriesByExhibitionId,
  getSessionsByExhibitionId,
  createTicketCategory,
  updateTicketCategory,
  updateExhibition,
  updateExhibitionStatus,
  updateTicketCategoryOtaXcOptionId,
  listSessionInventoryByTicketAndDateRange,
  listTicketCalendarInventoryByDateRange,
  getSessionTicketCategoriesBySessionId,
  getSessionInventoryBySessionId,
  updateTicketCategoryInventoryMax,
  updateTicketCalendarSessionPrice,
  getTicketCategoryByIdGlobal,
} from "../data/exhibition.js";
import { handleExhibitionError } from './errors.js';
import { RC7BaseService } from "./cr7.base.js";
import { HALF_SESSION_ID_REGEX, parseSelectedSessionId } from './session-id.js';

const { MoleculerClientError } = Errors;

const EXHIBITION_UPDATE_FIELDS = [
  'name',
  'description',
  'opening_time',
  'closing_time',
  'last_entry_time',
  'city',
  'venue_name',
  'location',
  'cover_url',
] as const;

const TICKET_CATEGORY_UPDATE_FIELDS = [
  'name',
  'price',
  'valid_duration_days',
  'refund_policy',
  'admittance',
] as const;

interface UserMeta {
  uid: string;
  roles?: string[];
}

type SessionMode = 'DAY' | 'HALF_DAY';

const AM_SESSION_END_TIME = '12:59:00';
const PM_SESSION_START_TIME = '13:00:00';

function parseClockTime(value: string): Date {
  const secondPrecision = parse(value, 'HH:mm:ss', new Date());
  if (!Number.isNaN(secondPrecision.getTime()) && format(secondPrecision, 'HH:mm:ss') === value) {
    return secondPrecision;
  }

  const minutePrecision = parse(value, 'HH:mm', new Date());
  if (!Number.isNaN(minutePrecision.getTime()) && format(minutePrecision, 'HH:mm') === value) {
    return minutePrecision;
  }

  throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
}

function formatClockTime(value: Date): string {
  return format(value, 'HH:mm:ss');
}

function buildDaySession(
  session: { id: string; exhibit_id: string; session_date: Date; created_at: Date; updated_at: Date },
  exhibition: Exhibition.Exhibition,
): Exhibition.Session {
  const dateStr = format(session.session_date, 'yyyy-MM-dd');
  return {
    ...session,
    name: dateStr,
    opening_time: `${dateStr} ${exhibition.opening_time}`,
    closing_time: `${dateStr} ${exhibition.closing_time}`,
    last_entry_time: `${dateStr} ${exhibition.last_entry_time}`,
  };
}

function buildHalfDaySessions(
  session: Exhibition.Session,
  exhibition: Exhibition.Exhibition,
): Exhibition.Session[] {
  const amSessionEndTime = parseClockTime(AM_SESSION_END_TIME);
  const pmSessionStartTime = parseClockTime(PM_SESSION_START_TIME);
  const exhibitionOpeningTime = formatClockTime(parseClockTime(exhibition.opening_time));
  const exhibitionClosingTime = parseClockTime(exhibition.closing_time);

  let pmSessionLastEntryTime = subMinutes(exhibitionClosingTime, 30);
  if (isBefore(pmSessionLastEntryTime, pmSessionStartTime)) {
    pmSessionLastEntryTime = pmSessionStartTime;
  }

  const amSessionEndTimeText = formatClockTime(amSessionEndTime);
  const pmSessionStartTimeText = formatClockTime(pmSessionStartTime);
  const pmSessionClosingTimeText = formatClockTime(exhibitionClosingTime);
  const pmSessionLastEntryTimeText = formatClockTime(pmSessionLastEntryTime);

  const dateStr = format(session.session_date, 'yyyy-MM-dd');

  return [
    {
      ...session,
      id: `${session.id}-AM`,
      name: '上午场',
      opening_time: `${dateStr} ${exhibitionOpeningTime}`,
      closing_time: `${dateStr} ${amSessionEndTimeText}`,
      last_entry_time: `${dateStr} ${amSessionEndTimeText}`,
    },
    {
      ...session,
      id: `${session.id}-PM`,
      name: '下午场',
      opening_time: `${dateStr} ${pmSessionStartTimeText}`,
      closing_time: `${dateStr} ${pmSessionClosingTimeText}`,
      last_entry_time: `${dateStr} ${pmSessionLastEntryTimeText}`,
    },
  ];
}

/**
 * ExhibitionService
 * 展览活动相关服务，提供展览和票种管理功能
 */
export class ExhibitionService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);
  }

  actions_exhibition: ServiceSchema['actions'] = {
    'exhibition.list': {
      rest: 'GET /',
      params: {
        limit: { type: 'number', optional: true, default: 10, min: 1, max: 100, convert: true },
        offset: { type: 'number', optional: true, default: 0, min: 0, convert: true },
        all: { type: 'boolean', optional: true, default: false, convert: true },
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
        city: 'string',
        venue_name: 'string',
        location: 'string',
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.createExhibition
    },

    'exhibition.get': {
      rest: 'GET /:eid',
      params: {
        eid: 'uuid'
      },
      handler: this.getExhibition
    },

    'exhibition.getTicketCategories': {
      rest: 'GET /:eid/tickets',
      params: {
        eid: 'uuid'
      },
      handler: this.getTicketCategories
    },

    'exhibition.getSessions': {
      rest: 'GET /:eid/sessions',
      params: {
        eid: 'uuid',
        session_mode: {
          type: 'enum',
          values: ['DAY', 'HALF_DAY'],
          optional: true,
          default: 'HALF_DAY',
        },
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

    'exhibition.getSession': {
      visibility: 'protected',
      params: {
        eid: 'uuid',
        sid: ['uuid', { type: 'string', pattern: HALF_SESSION_ID_REGEX.source }],
      },
      handler: this.getSession,
    },

    'exhibition.addTicketCategory': {
      rest: 'POST /:eid/tickets',
      roles: ['admin'],
      params: {
        eid: 'uuid',
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
        eid: 'uuid',
        name: { type: 'string', optional: true, min: 1 },
        description: { type: 'string', optional: true },
        opening_time: { type: 'string', optional: true },
        closing_time: { type: 'string', optional: true },
        last_entry_time: { type: 'string', optional: true },
        city: { type: 'string', optional: true },
        venue_name: { type: 'string', optional: true },
        location: { type: 'string', optional: true },
        cover_url: { type: 'url', optional: true, nullable: true },
      },
      handler: this.updateExhibition
    },

    'exhibition.updateTicketCategory': {
      rest: 'PATCH /:eid/tickets/:tid',
      roles: ['admin'],
      params: {
        eid: 'uuid',
        tid: 'uuid',
        name: { type: 'string', optional: true, min: 1 },
        price: { type: 'number', optional: true },
        valid_duration_days: { type: 'number', optional: true },
        refund_policy: {
          type: 'enum',
          optional: true,
          values: ['NON_REFUNDABLE', 'REFUNDABLE_48H_BEFORE'],
        },
        admittance: { type: 'number', optional: true },
      },
      handler: this.updateTicketCategory
    },

    'exhibition.updateStatus': {
      rest: 'PATCH /:eid/status',
      roles: ['admin'],
      params: {
        eid: 'uuid',
        status: { type: 'enum', values: ['ENABLE', 'DISABLE'] },
      },
      handler: this.updateExhibitionStatus
    },

    'exhibition.getSessionTickets': {
      rest: 'GET /:eid/sessions/:sid/tickets',
      params: {
        eid: 'uuid',
        sid: ['uuid', { type: 'string', pattern: HALF_SESSION_ID_REGEX.source }],
      },
      handler: this.getSessionTickets
    },

    'exhibition.updateTicketCategoryInventoryMax': {
      roles: ['admin'],
      rest: 'PUT /:eid/sessions/tickets/:tid/inventory/max',
      params: {
        eid: 'uuid',
        tid: 'uuid',
        quantity: 'number|min:0',
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
      handler: this.updateTicketCategoryInventoryMax
    },

    'exhibition.listTicketCalendarInventory': {
      roles: ['admin'],
      rest: 'GET /:eid/tickets/:tid/calendar',
      params: {
        eid: 'uuid',
        tid: 'uuid',
        start_session_date: {
          type: 'date',
          convert: true,
        },
        end_session_date: {
          type: 'date',
          convert: true,
        },
      },
      handler: this.listTicketCalendarInventory,
    },

    'exhibition.updateTicketCalendarPrice': {
      roles: ['admin'],
      rest: 'PUT /:eid/tickets/:tid/calendar/price',
      params: {
        eid: 'uuid',
        tid: 'uuid',
        price: 'number|integer|min:0',
        start_session_date: {
          type: 'date',
          convert: true,
        },
        end_session_date: {
          type: 'date',
          convert: true,
        },
      },
      handler: this.updateTicketCalendarPrice,
    },

    'exhibition.getTicket': {
      visibility: 'protected',
      params: {
        eid: 'uuid',
        tid: 'uuid',
      },
      handler: this.getTicket,
    },

    'exhibition.updateTicketXcOptionId': {
      visibility: 'protected',
      params: {
        eid: 'uuid',
        tid: 'uuid',
        ota_option_id: 'string|min:1',
      },
      handler: this.updateTicketXcOptionId,
    },

    'exhibition.listSessionInventoryByTicketAndDateRange': {
      visibility: 'protected',
      params: {
        eid: 'uuid',
        tid: 'uuid',
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

    'exhibition.getTicketByIdGlobal': {
      visibility: 'protected',
      params: {
        tid: 'uuid',
      },
      handler: this.getTicketByIdGlobal,
    },
  }

  async createExhibition(
    ctx: Context<Omit<Exhibition.Exhibition, 'id' | 'status' | 'created_at' | 'updated_at'>, { user: UserMeta }>
  ) {
    const client = this.pool;
    const schema = await this.getSchema();

    const exhibition = await createExhibition(client, schema, ctx.params);

    return exhibition;
  }

  async listExhibitions(
    ctx: Context<
      { limit?: number; offset?: number; all?: boolean },
      { user: UserMeta; roles?: string[] }
    >
  ) {
    const { limit = 10, offset = 0, all = false } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();
    const isAdmin = (ctx.meta.roles ?? []).some((role) => role.toLowerCase() === 'admin');
    const includeAll = all && isAdmin;

    const { exhibitions, total } = await getExhibitions(client, schema, includeAll, limit, offset);

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
      session_mode?: SessionMode;
      start_session_date?: Date;
      end_session_date?: Date;
    }, { user: UserMeta }>
  ) {
    const {
      eid,
      session_mode = 'HALF_DAY',
      start_session_date,
      end_session_date,
    } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const exhibition = await getExhibitionById(client, schema, eid);
    const rawSessions = await getSessionsByExhibitionId(
      client, schema, eid, start_session_date, end_session_date
    );

    const daySessions = rawSessions.map((session) => buildDaySession(session, exhibition));

    if (session_mode === 'DAY') {
      return daySessions;
    }

    return daySessions.flatMap((session) => buildHalfDaySessions(session, exhibition));
  }

  async getSession(
    ctx: Context<{ eid: string; sid: string }, { user: UserMeta }>
  ) {
    const { eid, sid } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const exhibition = await getExhibitionById(client, schema, eid)
      .catch(handleExhibitionError);

    const { sessionId: daySessionId, sessionHalf } = parseSelectedSessionId(sid);

    const rawSession = await getSessionById(client, schema, daySessionId)
      .catch(handleExhibitionError);

    if (rawSession.exhibit_id !== eid) {
      throw new MoleculerClientError('场次不存在', 404, 'SESSION_NOT_FOUND');
    }

    const daySession = buildDaySession(rawSession, exhibition);
    if (sessionHalf === null) {
      return daySession;
    }

    const targetSession = buildHalfDaySessions(daySession, exhibition)
      .find((session) => session.id === `${daySession.id}-${sessionHalf}`);

    if (!targetSession) {
      throw new MoleculerClientError('场次不存在', 404, 'SESSION_NOT_FOUND');
    }

    return targetSession;
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

  async updateTicketCategory(
    ctx: Context<{ eid: string; tid: string } & Exhibition.TicketCategoryPatch, { user: UserMeta }>
  ) {
    const { eid, tid, ...patch } = ctx.params;

    if (TICKET_CATEGORY_UPDATE_FIELDS.every(field => Object.hasOwn(patch, field) === false)) {
      throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
    }

    const client = this.pool;
    const schema = await this.getSchema();

    return updateTicketCategory(client, schema, eid, tid, patch)
      .catch(handleExhibitionError);
  }

  async updateExhibitionStatus(
    ctx: Context<{ eid: string; status: Exhibition.ExhibitionStatus }, { user: UserMeta; $statusCode?: number }>
  ) {
    const { eid, status } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    await updateExhibitionStatus(client, schema, eid, status)
      .catch(handleExhibitionError);

    ctx.meta.$statusCode = 204;
  }

  async getSessionTickets(
    ctx: Context<{ eid: string; sid: string }, { user: UserMeta }>
  ) {
    const { eid, sid } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();

    const daySessionId = sid.replace(/-(AM|PM)$/, '');
    const tickets = await getSessionTicketCategoriesBySessionId(client, schema, eid, daySessionId);
    const inventory = await getSessionInventoryBySessionId(client, schema, eid, daySessionId);

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
      {
        eid: string;
        tid: string;
        quantity: number;
        start_session_date?: Date;
        end_session_date?: Date;
      },
      { user: UserMeta, $statusCode?: number }
    >
  ) {
    const {
      eid,
      tid,
      quantity,
      start_session_date,
      end_session_date,
    } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();
    const exhibition = await getExhibitionById(client, schema, eid)
      .catch(handleExhibitionError);

    const effectiveStartDate = start_session_date ?? exhibition.start_date;
    const effectiveEndDate = end_session_date ?? exhibition.end_date;

    if (isBefore(effectiveEndDate, effectiveStartDate)) {
      throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
    }

    await updateTicketCategoryInventoryMax(
      client,
      schema,
      eid,
      tid,
      quantity,
      effectiveStartDate,
      effectiveEndDate
    );

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

  async listTicketCalendarInventory(
    ctx: Context<{ eid: string; tid: string; start_session_date: Date; end_session_date: Date }>
  ) {
    const { eid, tid, start_session_date, end_session_date } = ctx.params;

    if (start_session_date.getTime() > end_session_date.getTime()) {
      throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
    }

    const schema = await this.getSchema();
    return listTicketCalendarInventoryByDateRange(
      this.pool,
      schema,
      eid,
      tid,
      start_session_date,
      end_session_date,
    );
  }

  async updateTicketCalendarPrice(
    ctx: Context<
      {
        eid: string;
        tid: string;
        price: number;
        start_session_date: Date;
        end_session_date: Date;
      },
      { user: UserMeta; $statusCode?: number }
    >
  ) {
    const { eid, tid, price, start_session_date, end_session_date } = ctx.params;

    if (isBefore(end_session_date, start_session_date)) {
      throw new MoleculerClientError('参数不合法', 400, 'INVALID_ARGUMENT');
    }

    const schema = await this.getSchema();
    await updateTicketCalendarSessionPrice(
      this.pool,
      schema,
      eid,
      tid,
      price,
      start_session_date,
      end_session_date,
    ).catch(handleExhibitionError);

    ctx.meta.$statusCode = 204;
  }

  async getTicketByIdGlobal(ctx: Context<{ tid: string }>) {
    const { tid } = ctx.params;
    const schema = await this.getSchema();
    return getTicketCategoryByIdGlobal(this.pool, schema, tid)
      .catch(handleExhibitionError);
  }
}

