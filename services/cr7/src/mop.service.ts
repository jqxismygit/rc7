import { readFile } from 'node:fs/promises';
import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Exhibition } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { mopPostJSON } from './libs/mop.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
}

type CityMeta = {
  id: string;
  name: string;
};

type MopProjectSyncRequest = {
  cityId: string;
  cityName: string;
  otProjectId: string;
  category: number;
  otVenueId: string;
  otVenueName: string;
  projectStatus: number;
  name: string;
};

type MopShow = {
  otShowId: string;
  otShowStatus: number;
  startTime: string;
  endTime: string;
  showType: number;
  fetchTicketWay: number[];
  maxBuyLimitPerOrder: number;
};

type MopShowSyncRequest = {
  otProjectId: string;
  shows: MopShow[];
};

const MOP_PROJECT_CATEGORY_LEISURE_EXHIBITION = {
  label: '休闲展览',
  value: 9,
} as const;

const MOP_PROJECT_STATUS_VALID = 1;
const MOP_SHOW_STATUS_VALID = 1;
const MOP_SHOW_TYPE_SINGLE = 1;
const MOP_FETCH_TICKET_WAY_E_TICKET = 2;
const MOP_SHOW_MAX_BUY_LIMIT_PER_ORDER = 6;

const SUPPORTED_CITIES: Record<string, CityMeta> = {
  上海: { id: '310000', name: '上海市' },
};

function getCityMeta(cityName: string): CityMeta {
  const city = SUPPORTED_CITIES[cityName];
  if (!city) {
    throw new MoleculerClientError(`暂不支持同步城市: ${cityName}`, 400, 'MOP_CITY_NOT_SUPPORTED');
  }

  return city;
}

async function readKey(path: string) {
  return readFile(path, 'utf-8').then(content => content.trim());
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

function toDateLabel(value: string | Date): string {
  const dateValue = isDate(value) ? value : parseISO(value);
  if (Number.isNaN(dateValue.getTime())) {
    return String(value).slice(0, 10);
  }

  return format(dateValue, 'yyyy-MM-dd');
}

function formatMopDateTime(sessionDate: string | Date, time: string): string {
  const dateLabel = toDateLabel(sessionDate);
  const dateTimeLabel = `${dateLabel} ${normalizeTimeLabel(time)}`;
  const parsed = parse(dateTimeLabel, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (Number.isNaN(parsed.getTime())) {
    throw new MoleculerClientError(
      `场次时间格式不合法: ${dateTimeLabel}`,
      400,
      'MOP_SESSION_DATETIME_INVALID',
    );
  }

  return format(parsed, 'yyyy-MM-dd HH:mm:ss');
}

export default class MoeService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'mop',
      settings: {
        $noVersionPrefix: true,
      },

      hooks: {
        before: {
          '*': ['checkUserRole'],
        },
      },

      actions: {
        syncExhibitionToMop: {
          rest: 'POST /:eid/ota/mop/sync',
          roles: ['admin'],
          params: {
            eid: 'string',
          },
          handler: this.syncExhibitionToMop,
        },
        syncSessionsToMop: {
          rest: 'POST /:eid/ota/mop/sync/sessions',
          roles: ['admin'],
          params: {
            eid: 'string',
          },
          handler: this.syncSessionsToMop,
        },
      },

      async started() {
        await this.initPool();
      },

      async stopped() {
        await this.closePool();
      },
    });
  }

  async syncExhibitionToMop(
    ctx: Context<{ eid: string }, UserMeta & { $statusCode?: number }>,
  ): Promise<void> {
    const { eid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get', { eid }
    );

    const cityMeta = getCityMeta(exhibition.city);
    const request: MopProjectSyncRequest = {
      cityId: cityMeta.id,
      cityName: cityMeta.name,
      otProjectId: exhibition.id,
      category: MOP_PROJECT_CATEGORY_LEISURE_EXHIBITION.value,
      otVenueId: exhibition.id,
      otVenueName: exhibition.venue_name,
      projectStatus: MOP_PROJECT_STATUS_VALID,
      name: exhibition.name,
    };

    const privateKey = await readKey(config.mop.private_key_path);
    const publicKey = await readKey(config.mop.public_key_path);

    const syncUrl = new URL('/supply/open/mop/project/push', config.mop.base_url).toString();

    await mopPostJSON(syncUrl, {
      supplier: config.mop.supplier,
      aesKey: config.mop.aes_key,
      privateKey,
      responsePublicKey: publicKey,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async syncSessionsToMop(
    ctx: Context<{ eid: string }, UserMeta & { $statusCode?: number }>,
  ): Promise<void> {
    const { eid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get', { eid }
    );
    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions', { eid }
    );
    const sortedSessions = [...sessions].sort((left, right) => {
      const leftDate = toDateLabel(left.session_date);
      const rightDate = toDateLabel(right.session_date);
      return leftDate.localeCompare(rightDate);
    });

    const request: MopShowSyncRequest = {
      otProjectId: exhibition.id,
      shows: sortedSessions.map(session => ({
        otShowId: session.id,
        otShowStatus: MOP_SHOW_STATUS_VALID,
        startTime: formatMopDateTime(session.session_date, exhibition.opening_time),
        endTime: formatMopDateTime(session.session_date, exhibition.closing_time),
        showType: MOP_SHOW_TYPE_SINGLE,
        fetchTicketWay: [MOP_FETCH_TICKET_WAY_E_TICKET],
        maxBuyLimitPerOrder: MOP_SHOW_MAX_BUY_LIMIT_PER_ORDER,
      })),
    };

    const privateKey = await readKey(config.mop.private_key_path);
    const publicKey = await readKey(config.mop.public_key_path);

    const syncUrl = new URL('/supply/open/mop/show/push', config.mop.base_url).toString();

    await mopPostJSON(syncUrl, {
      supplier: config.mop.supplier,
      aesKey: config.mop.aes_key,
      privateKey,
      responsePublicKey: publicKey,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }
}
