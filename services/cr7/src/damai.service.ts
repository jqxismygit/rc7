import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Exhibition } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { damaiPostJson } from './libs/damai.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
  $statusCode?: number;
}

type DamaiProjectSyncRequest = {
  projectInfo: {
    id: string;
    name: string;
    chooseSeatFlag: boolean;
    posters: string | null;
    introduce: string;
  };
  venueInfo: {
    id: string;
    name: string;
  };
};

type DamaiPerform = {
  id: string;
  performName: string;
  status: number;
  saleStartTime: string;
  saleEndTime: string;
  showTime: string;
  endTime: string;
  ticketTypeAndDeliveryMethod: Record<string, number[]>;
  ruleType: number;
};

type DamaiPerformSyncRequest = {
  projectId: string;
  performs: DamaiPerform[];
};

type DamaiPrice = {
  id: string;
  name: string;
  price: number;
  saleState: number;
};

type DamaiPriceSyncRequest = {
  projectId: string;
  performId: string;
  priceList: DamaiPrice[];
};

type ExhibitionSessionTicket = Exhibition.TicketCategory & {
  session_id: string;
  quantity: number;
};

const DAMAI_PERFORM_STATUS_ENABLED = 1;
const DAMAI_TICKET_TYPE_ELECTRONIC = 2;
const DAMAI_RULE_TYPE_NON_REAL_NAME = 0;
const DAMAI_TICKET_SALE_STATE_ON_SALE = 1;

function toDateValue(value: string | Date): Date {
  if (isDate(value)) {
    return value;
  }

  return parseISO(value);
}

function toDateLabel(value: string | Date): string {
  const parsed = toDateValue(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 10);
  }

  return format(parsed, 'yyyy-MM-dd');
}

function normalizeTimeLabel(time: string): string {
  const secondPrecision = parse(time, 'HH:mm:ss', new Date());
  if (!Number.isNaN(secondPrecision.getTime()) && format(secondPrecision, 'HH:mm:ss') === time) {
    return time;
  }

  const minutePrecision = parse(time, 'HH:mm', new Date());
  if (!Number.isNaN(minutePrecision.getTime()) && format(minutePrecision, 'HH:mm') === time) {
    return format(minutePrecision, 'HH:mm:ss');
  }

  return time;
}

function formatDamaiDate(value: string | Date): string {
  const parsed = toDateValue(value);
  return format(parsed, 'yyyy-MM-dd');
}

function formatDamaiDateTime(value: string | Date): string {
  const parsed = toDateValue(value);
  return format(parsed, 'yyyy-MM-dd HH:mm:ss');
}

function formatDamaiSessionDateTime(sessionDate: string | Date, time: string, pattern: 'HH:mm' | 'HH:mm:ss'): string {
  const dateLabel = toDateLabel(sessionDate);
  const dateTimeLabel = `${dateLabel} ${normalizeTimeLabel(time)}`;
  const parsed = parse(dateTimeLabel, 'yyyy-MM-dd HH:mm:ss', new Date());
  return format(parsed, `yyyy-MM-dd ${pattern}`);
}

class DamaiService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'damai',
      settings: {},
      hooks: {
        before: {
          '*': ['checkUserRole'],
        },
      },
      actions: {
        syncExhibitionToDamai: {
          rest: 'POST /:eid/ota/damai/sync',
          roles: ['admin'],
          params: {
            eid: 'string',
          },
          handler: this.syncExhibitionToDamai,
        },
        syncSessionsToDamai: {
          rest: 'POST /:eid/ota/damai/sync/sessions',
          roles: ['admin'],
          params: {
            eid: 'string',
            start_session_date: { type: 'date', convert: true, optional: true },
            end_session_date: { type: 'date', convert: true, optional: true },
          },
          handler: this.syncSessionsToDamai,
        },
        syncTicketsToDamai: {
          rest: 'POST /:eid/sessions/:sid/ota/damai/sync/tickets',
          roles: ['admin'],
          params: {
            eid: 'string',
            sid: 'string',
          },
          handler: this.syncTicketsToDamai,
        },
      },
    });
  }

  async syncExhibitionToDamai(ctx: Context<{ eid: string }, UserMeta>): Promise<void> {
    const { eid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get',
      { eid },
    );

    const request: DamaiProjectSyncRequest = {
      projectInfo: {
        id: exhibition.id,
        name: exhibition.name,
        chooseSeatFlag: false,
        posters: exhibition.cover_url ?? null,
        introduce: exhibition.description,
      },
      venueInfo: {
        id: exhibition.id,
        name: exhibition.venue_name,
      },
    };

    const syncUrl = new URL('/b2b2c/2.0/sync/project', config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      apiKey: config.damai.api_key,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async syncSessionsToDamai(
    ctx: Context<{ eid: string; start_session_date?: Date; end_session_date?: Date }, UserMeta>
  ): Promise<void> {
    const { eid, start_session_date, end_session_date } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get',
      { eid },
    );
    const query: { eid: string; start_session_date?: Date; end_session_date?: Date } = { eid };
    if (start_session_date) {
      query.start_session_date = start_session_date;
    }
    if (end_session_date) {
      query.end_session_date = end_session_date;
    }

    const sessions = await ctx.call<
      Exhibition.Session[],
      { eid: string; start_session_date?: Date; end_session_date?: Date }
    >('cr7.exhibition.getSessions', query);
    const sortedSessions = [...sessions].sort((left, right) => {
      const leftDate = toDateLabel(left.session_date);
      const rightDate = toDateLabel(right.session_date);
      return leftDate.localeCompare(rightDate);
    });

    const request: DamaiPerformSyncRequest = {
      projectId: exhibition.id,
      performs: sortedSessions.map(session => ({
        id: session.id,
        performName: formatDamaiDate(session.session_date),
        status: DAMAI_PERFORM_STATUS_ENABLED,
        saleStartTime: formatDamaiDateTime(exhibition.created_at),
        saleEndTime: formatDamaiSessionDateTime(session.session_date, exhibition.last_entry_time, 'HH:mm'),
        showTime: formatDamaiSessionDateTime(session.session_date, exhibition.opening_time, 'HH:mm'),
        endTime: formatDamaiSessionDateTime(session.session_date, exhibition.closing_time, 'HH:mm'),
        ticketTypeAndDeliveryMethod: {
          [DAMAI_TICKET_TYPE_ELECTRONIC]: [DAMAI_TICKET_TYPE_ELECTRONIC],
        },
        ruleType: DAMAI_RULE_TYPE_NON_REAL_NAME,
      })),
    };

    const syncUrl = new URL('/b2b2c/2.0/sync/perform', config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      apiKey: config.damai.api_key,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async syncTicketsToDamai(
    ctx: Context<{ eid: string; sid: string }, UserMeta>
  ): Promise<void> {
    const { eid, sid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get',
      { eid },
    );

    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>('cr7.exhibition.getSessions', { eid });
    const session = sessions.find(item => item.id === sid);

    if (!session) {
      throw new MoleculerClientError('场次不存在', 404, 'SESSION_NOT_FOUND');
    }

    const tickets = await ctx.call<
      ExhibitionSessionTicket[],
      { eid: string; sid: string }
    >('cr7.exhibition.getSessionTickets', {
      eid,
      sid,
    });

    const request: DamaiPriceSyncRequest = {
      projectId: exhibition.id,
      performId: sid,
      priceList: tickets.map(ticket => ({
        id: ticket.id,
        name: ticket.name,
        price: ticket.price,
        saleState: DAMAI_TICKET_SALE_STATE_ON_SALE,
      })),
    };

    const syncUrl = new URL('/b2b2c/2.0/sync/price', config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      apiKey: config.damai.api_key,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }
}

export default DamaiService;
