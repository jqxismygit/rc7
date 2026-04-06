import { readFile } from 'node:fs/promises';
import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Exhibition, Order } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import {
  buildMopResponseSign,
  decryptMopData,
  encryptMopData,
  mopPostJSON,
  verifyMopSign,
} from './libs/mop.js';

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

type MopSku = {
  otSkuId: string;
  otSkuStatus: number;
  name: string;
  skuPrice: string;
  sellPrice: string;
  onSaleTime: string;
  offSaleTime: string;
  inventoryType: number;
};

type MopSkuSyncRequest = {
  otProjectId: string;
  isOta: number;
  skus: MopSku[];
};

type MopOrderTicket = {
  myTicketId: string;
  skuId: string;
  ticketPrice: string;
};

type MopOrderCreateRequest = {
  myOrderId: string;
  projectCode: string;
  projectShowCode: string;
  buyerName: string;
  buyerPhone: string;
  totalPrice: string;
  needSeat: boolean;
  needRealName: boolean;
  ticketInfo: MopOrderTicket[];
};

type MopOrderCreateResponse = {
  myOrderId: string;
  channelOrderId: string;
  payExpiredTime: string;
};

type MopResponseEnvelope = {
  code: number;
  timestamp: string;
  msg: string;
  sign: string;
  encryptData: string | null;
};

type MopRequestHeaders = Record<string, string | string[] | undefined>;

type MopSignValidationResult =
  | { ok: true }
  | { ok: false; response: MopResponseEnvelope };

type MopDecryptResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: MopResponseEnvelope };

const MOP_PROJECT_CATEGORY_LEISURE_EXHIBITION = {
  label: '休闲展览',
  value: 9,
} as const;

const MOP_PROJECT_STATUS_VALID = 1;
const MOP_SHOW_STATUS_VALID = 1;
const MOP_SHOW_TYPE_SINGLE = 1;
const MOP_FETCH_TICKET_WAY_E_TICKET = 2;
const MOP_SHOW_MAX_BUY_LIMIT_PER_ORDER = 6;
const MOP_SKU_STATUS_VALID = 1;
const MOP_SKU_IS_OTA = 1;
const MOP_INVENTORY_TYPE_SHARED = 1;
const MOP_ORDER_URI = '/mop/order';

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

function toYuanString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function getHeaderValue(
  headers: MopRequestHeaders,
  key: string,
): string | null {
  const value = headers[key];
  if (value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
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
        syncTicketsToMop: {
          rest: 'POST /:eid/ota/mop/sync/tickets',
          roles: ['admin'],
          params: {
            eid: 'string',
          },
          handler: this.syncTicketsToMop,
        },
        receiveOrderFromMop: {
          rest: 'POST /order',
          params: {
            encryptData: 'string',
          },
          handler: this.receiveOrderFromMop,
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

  async syncTicketsToMop(
    ctx: Context<{ eid: string }, UserMeta & { $statusCode?: number }>,
  ): Promise<void> {
    const { eid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get', { eid }
    );
    const ticketCategories = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories', { eid }
    );

    const request: MopSkuSyncRequest = {
      otProjectId: exhibition.id,
      isOta: MOP_SKU_IS_OTA,
      skus: ticketCategories.map(ticket => ({
        otSkuId: ticket.id,
        otSkuStatus: MOP_SKU_STATUS_VALID,
        name: ticket.name,
        skuPrice: toYuanString(ticket.price),
        sellPrice: toYuanString(ticket.price),
        onSaleTime: formatMopDateTime(exhibition.start_date, exhibition.opening_time),
        offSaleTime: formatMopDateTime(exhibition.end_date, exhibition.closing_time),
        inventoryType: MOP_INVENTORY_TYPE_SHARED,
      })),
    };

    const privateKey = await readKey(config.mop.private_key_path);
    const publicKey = await readKey(config.mop.public_key_path);

    const syncUrl = new URL('/supply/open/mop/sku/push', config.mop.base_url).toString();

    await mopPostJSON(syncUrl, {
      supplier: config.mop.supplier,
      aesKey: config.mop.aes_key,
      privateKey,
      responsePublicKey: publicKey,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async buildMopResponse(
    code: number,
    msg: string,
    body: unknown = null,
  ): Promise<MopResponseEnvelope> {
    const privateKey = await readKey(config.mop.private_key_path);
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const { sign } = buildMopResponseSign({ code, timestamp, privateKey });

    return {
      code,
      msg,
      timestamp,
      sign,
      encryptData: body === null
        ? null
        : encryptMopData(JSON.stringify(body), config.mop.aes_key),
    };
  }

  async validateMopSign(
    headers: MopRequestHeaders,
    signUri: string,
  ): Promise<MopSignValidationResult> {
    const supplier = getHeaderValue(headers, 'supplier');
    const timestamp = getHeaderValue(headers, 'timestamp');
    const version = getHeaderValue(headers, 'version');
    const sign = getHeaderValue(headers, 'sign');

    if (!supplier || !timestamp || !version || !sign) {
      return {
        ok: false,
        response: await this.buildMopResponse(10001, '参数异常'),
      };
    }

    if (supplier !== config.mop.supplier) {
      return {
        ok: false,
        response: await this.buildMopResponse(10001, '参数异常'),
      };
    }

    const publicKey = await readKey(config.mop.public_key_path);
    const verified = verifyMopSign(sign, signUri, {
      supplier,
      timestamp,
      version,
      publicKey,
    });

    if (!verified) {
      return {
        ok: false,
        response: await this.buildMopResponse(10001, '签名验证失败'),
      };
    }

    return { ok: true };
  }

  async decryptMopRequestBody<T>(encryptData: string): Promise<MopDecryptResult<T>> {
    try {
      const decrypted = decryptMopData(encryptData, config.mop.aes_key);
      return {
        ok: true,
        body: JSON.parse(decrypted) as T,
      };
    } catch {
      return {
        ok: false,
        response: await this.buildMopResponse(10001, '报文解析失败'),
      };
    }
  }

  async receiveOrderFromMop(
    ctx: Context<{ encryptData: string }, { headers?: Record<string, string | string[]>; $statusCode?: number }>,
  ): Promise<MopResponseEnvelope> {
    ctx.meta.$statusCode = 200;

    const headers = ctx.meta.headers ?? {};
    const signValidation = await this.validateMopSign(headers, MOP_ORDER_URI);
    if (!signValidation.ok) {
      return signValidation.response;
    }

    const decryptResult = await this.decryptMopRequestBody<MopOrderCreateRequest>(
      ctx.params.encryptData,
    );
    if (!decryptResult.ok) {
      return decryptResult.response;
    }

    const requestBody = decryptResult.body;

    const {
      myOrderId,
      projectCode,
      projectShowCode,
      buyerName,
      buyerPhone,
      totalPrice,
      ticketInfo,
    } = requestBody;

    if (
      !myOrderId ||
      !projectCode ||
      !projectShowCode ||
      !buyerName ||
      !buyerPhone ||
      !totalPrice ||
      !Array.isArray(ticketInfo) ||
      ticketInfo.length === 0
    ) {
      return this.buildMopResponse(10001, '参数异常');
    }

    const exhibition = await ctx.call<Exhibition.Exhibition | null, { eid: string }>(
      'cr7.exhibition.get',
      { eid: projectCode },
    ).catch(() => null);

    if (!exhibition) {
      return this.buildMopResponse(30003, '项目状态异常');
    }

    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions',
      { eid: projectCode },
    );
    const session = sessions.find(item => item.id === projectShowCode) ?? null;

    if (!session) {
      return this.buildMopResponse(30004, '场次状态异常');
    }

    const ticketCategories = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories',
      { eid: projectCode },
    );
    const ticketById = new Map(ticketCategories.map(ticket => [ticket.id, ticket]));

    const totalPriceFromItems = ticketInfo.reduce((sum, item) => sum + Number(item.ticketPrice), 0);
    if (Number(totalPrice).toFixed(2) !== totalPriceFromItems.toFixed(2)) {
      return this.buildMopResponse(30002, '订单价格不一致');
    }

    const itemCountBySku = new Map<string, number>();
    for (const item of ticketInfo) {
      const ticket = ticketById.get(item.skuId);
      if (!ticket) {
        return this.buildMopResponse(30005, '票档状态异常');
      }

      const expectedPrice = Number(toYuanString(ticket.price));
      if (Number(item.ticketPrice) !== expectedPrice) {
        return this.buildMopResponse(30002, '订单价格不一致');
      }

      itemCountBySku.set(item.skuId, (itemCountBySku.get(item.skuId) ?? 0) + 1);
    }

    const userId = await ctx.call<string, { country_code: string; phone: string; name: string }>(
      'user.findOrCreateByPhone',
      {
        country_code: '+86',
        phone: buyerPhone,
        name: buyerName,
      },
    );

    try {
      const order = await ctx.call<Order.OrderWithItems, {
        eid: string;
        sid: string;
        items: Order.CreateOrderItem[];
        source: Order.OrderSource;
        user_id: string;
      }>('cr7.order.create', {
        eid: projectCode,
        sid: projectShowCode,
        items: Array.from(itemCountBySku.entries()).map(([ticket_category_id, quantity]) => ({
          ticket_category_id,
          quantity,
        })),
        source: 'DIRECT',
        user_id: userId,
      });

      const responseBody: MopOrderCreateResponse = {
        myOrderId,
        channelOrderId: order.id,
        payExpiredTime: String(new Date(order.expires_at).getTime()),
      };

      return this.buildMopResponse(10000, '成功', responseBody);
    } catch (error) {
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === 'INVENTORY_NOT_ENOUGH') {
        return this.buildMopResponse(30006, '库存不足');
      }

      this.logger.error('处理 MOP 订单同步时发生错误', error);
      return this.buildMopResponse(10099, '系统异常');
    }
  }
}
