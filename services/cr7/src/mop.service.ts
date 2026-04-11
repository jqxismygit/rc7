import { readFile } from 'node:fs/promises';
import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Exhibition, Inventory, Mop, Order, Redeem } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { getCityMetaById } from './libs/city.js';
import {
  createMopOrderSyncRecord,
  getFirstSuccessfulMopOrderSyncRecordByMyOrderId,
  getSuccessfulOrderCreateRecordByOrderId,
  listMopOrderSyncRecordsByOrderId,
  updateMopOrderSyncRecord,
} from './data/mop.js';
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

type MopProjectSyncRequest = {
  cityId: string;
  cityName: string;
  otProjectId: string;
  category: number;
  otVenueId: string;
  otVenueName: string;
  projectStatus: number;
  seatType: 1 | 2;
  needRealName: 0 | 1;
  name: string;
};

type MopShow = {
  otShowId: string;
  otShowStatus: number;
  startTime: string;
  endTime: string;
  showType: number;
  offSaleTime: string;
  fetchTicketWay: number[];
  maxBuyLimitPerOrder: number;
};

type MopShowSyncRequest = {
  otProjectId: string;
  shows: MopShow[];
};

type MopSku = {
  otShowId: string;
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

type MopStock = {
  otShowId: string;
  otSkuId: string;
  inventoryType: number;
  stock: number;
};

type MopStockSyncRequest = {
  otProjectId: string;
  stocks: MopStock[];
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
  mobileNoAreaCode: string;
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

type MopOrderQueryRequest = {
  myOrderId: string;
};

type MopOrderQueryResponse = {
  myOrderId: string;
  fetchCode: string | null;
  fetchQrCode: string | null;
  orderStatus: number;
  orderRefundStatus: number;
  orderConsumeStatus: number;
  ticketInfo: Array<{
    myTicketId: string;
    channelTicketId: string;
    ticketConsumeStatus: number;
    checkCode: string | null;
    checkQrCode: string | null;
  }>;
};

type MopTicketConfirmationRequest = {
  myOrderId: string;
};

type MopOrderStatusChangeRequest = {
  myOrderId: string;
  bizType: number;
};

type MopTicketConfirmationResponse = {
  myOrderId: string;
  fetchCode: string | null;
  fetchQrCode: string | null;
  orderStatus: number;
  ticketInfo: Array<{
    myTicketId: string;
    channelTicketId: string;
    checkCode: string | null;
    checkQrCode: string | null;
  }>;
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
const MOP_ORDER_QUERY_URI = '/mop/orderQuery';
const MOP_TICKET_URI = '/mop/ticket';
const MOP_ORDER_STATUS_CHANGE_URI = '/mop/orderStatusChange';
const MOP_CONSUME_URI = '/supply/open/mop/consume';
const MOP_ORDER_STATUS_CHANGE_BIZ_TYPE_CANCEL = 0;
const MOP_ORDER_STATUS_CHANGE_BIZ_TYPE_REFUND = 1;
const MOP_SEAT_TYPE_NONE = 1;
const MOP_NEED_REAL_NAME_NO = 0;


const MOP_ORDER_STATUS = {
  INITIAL: 0,
  CANCELED: 2,
  ISSUED: 7,
} as const;

const MOP_REFUND_STATUS = {
  NONE: 0,
  PROCESSING: 1,
  FAILED: 2,
  REFUNDED: 3,
} as const;

const MOP_CONSUME_STATUS = {
  NOT_CONSUMED: 0,
  CONSUMED: 1,
} as const;

function toMopOrderStatus(status: Order.OrderStatus): number {
  switch (status) {
    case 'PENDING_PAYMENT':
      return MOP_ORDER_STATUS.INITIAL;
    case 'CANCELLED':
    case 'EXPIRED':
      return MOP_ORDER_STATUS.CANCELED;
    case 'PAID':
    case 'REFUND_REQUESTED':
    case 'REFUND_PROCESSING':
    case 'REFUNDED':
    case 'REFUND_FAILED':
      return MOP_ORDER_STATUS.ISSUED;
    default:
      return MOP_ORDER_STATUS.INITIAL;
  }
}

function toMopRefundStatus(status: Order.OrderStatus): number {
  switch (status) {
    case 'REFUND_REQUESTED':
    case 'REFUND_PROCESSING':
      return MOP_REFUND_STATUS.PROCESSING;
    case 'REFUNDED':
      return MOP_REFUND_STATUS.REFUNDED;
    case 'REFUND_FAILED':
      return MOP_REFUND_STATUS.FAILED;
    default:
      return MOP_REFUND_STATUS.NONE;
  }
}

function getCityMeta(cityName: string) {
  const city = getCityMetaById(cityName);
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

function toMopCountryCode(mobileNoAreaCode: string | null | undefined): string {
  const trimmed = mobileNoAreaCode?.trim() ?? '';
  if (!trimmed) {
    return '+86';
  }

  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
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
            sessionDateStart: { type: 'string', optional: true },
            sessionDateEnd: { type: 'string', optional: true },
          },
          handler: this.syncTicketsToMop,
        },
        syncStocksToMop: {
          rest: 'POST /:eid/ota/mop/sync/stocks',
          roles: ['admin'],
          params: {
            eid: 'string',
            sessionDateStart: { type: 'string', optional: true },
            sessionDateEnd: { type: 'string', optional: true },
          },
          handler: this.syncStocksToMop,
        },
        receiveOrderFromMop: {
          rest: 'POST /order',
          params: {
            encryptData: 'string',
          },
          handler: this.receiveOrderFromMop,
        },
        queryOrderFromMop: {
          rest: 'POST /orderQuery',
          params: {
            encryptData: 'string',
          },
          handler: this.queryOrderFromMop,
        },
        receiveTicketFromMop: {
          rest: 'POST /ticket',
          params: {
            encryptData: 'string',
          },
          handler: this.receiveTicketFromMop,
        },
        receiveOrderStatusChangeFromMop: {
          rest: 'POST /orderStatusChange',
          params: {
            encryptData: 'string',
          },
          handler: this.receiveOrderStatusChangeFromMop,
        },
        getMopOrderRecord: {
          rest: 'GET /orders/:rid',
          roles: ['admin'],
          params: {
            rid: 'uuid',
          },
          handler: this.getMopOrderRecord,
        },

        notifyOrderConsumed: {
          params: {
            oid: 'string',
          },
          handler: this.notifyOrderConsumed,
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
      seatType: MOP_SEAT_TYPE_NONE,
      needRealName: MOP_NEED_REAL_NAME_NO,
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
        offSaleTime: formatMopDateTime(session.session_date, exhibition.last_entry_time),
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
    ctx: Context<{
      eid: string;
      sessionDateStart?: string;
      sessionDateEnd?: string;
    }, UserMeta & { $statusCode?: number }>,
  ): Promise<void> {
    const { eid, sessionDateStart, sessionDateEnd } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get', { eid }
    );
    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions', { eid }
    );
    const ticketCategories = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories', { eid }
    );

    const sessionDateStartLabel = sessionDateStart ? toDateLabel(sessionDateStart) : null;
    const sessionDateEndLabel = sessionDateEnd ? toDateLabel(sessionDateEnd) : null;

    if (
      sessionDateStartLabel !== null
      && sessionDateEndLabel !== null
      && sessionDateStartLabel.localeCompare(sessionDateEndLabel) > 0
    ) {
      throw new MoleculerClientError(
        '场次日期范围不合法: 开始日期不能晚于结束日期',
        400,
        'MOP_SESSION_DATE_RANGE_INVALID',
      );
    }

    const filteredSessions = sessions.filter(session => {
      const sessionDate = toDateLabel(session.session_date);
      if (sessionDateStartLabel !== null && sessionDate.localeCompare(sessionDateStartLabel) < 0) {
        return false;
      }
      if (sessionDateEndLabel !== null && sessionDate.localeCompare(sessionDateEndLabel) > 0) {
        return false;
      }
      return true;
    });

    const sortedSessions = [...filteredSessions].sort((left, right) => {
      const leftDate = toDateLabel(left.session_date);
      const rightDate = toDateLabel(right.session_date);
      const comparedDate = leftDate.localeCompare(rightDate);
      if (comparedDate !== 0) {
        return comparedDate;
      }
      return left.id.localeCompare(right.id);
    });

    const request: MopSkuSyncRequest = {
      otProjectId: exhibition.id,
      isOta: MOP_SKU_IS_OTA,
      skus: sortedSessions.flatMap(session => ticketCategories.map(ticket => ({
        otShowId: session.id,
        otSkuId: ticket.id,
        otSkuStatus: MOP_SKU_STATUS_VALID,
        name: ticket.name,
        skuPrice: toYuanString(ticket.price),
        sellPrice: toYuanString(ticket.price),
        onSaleTime: formatMopDateTime(exhibition.start_date, exhibition.opening_time),
        offSaleTime: formatMopDateTime(exhibition.end_date, exhibition.closing_time),
        inventoryType: MOP_INVENTORY_TYPE_SHARED,
      }))),
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

  async syncStocksToMop(
    ctx: Context<{
      eid: string;
      sessionDateStart?: string;
      sessionDateEnd?: string;
    }, UserMeta & { $statusCode?: number }>,
  ): Promise<void> {
    const { eid, sessionDateStart, sessionDateEnd } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get',
      { eid }
    );
    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions',
      { eid }
    );
    const ticketCategories = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories',
      { eid }
    );

    const sessionDateStartLabel = sessionDateStart ? toDateLabel(sessionDateStart) : null;
    const sessionDateEndLabel = sessionDateEnd ? toDateLabel(sessionDateEnd) : null;

    if (
      sessionDateStartLabel !== null
      && sessionDateEndLabel !== null
      && sessionDateStartLabel.localeCompare(sessionDateEndLabel) > 0
    ) {
      throw new MoleculerClientError(
        '场次日期范围不合法: 开始日期不能晚于结束日期',
        400,
        'MOP_SESSION_DATE_RANGE_INVALID',
      );
    }

    const filteredSessions = sessions.filter(session => {
      const sessionDate = toDateLabel(session.session_date);
      if (sessionDateStartLabel !== null && sessionDate.localeCompare(sessionDateStartLabel) < 0) {
        return false;
      }
      if (sessionDateEndLabel !== null && sessionDate.localeCompare(sessionDateEndLabel) > 0) {
        return false;
      }
      return true;
    });

    const sortedSessions = [...filteredSessions].sort((left, right) => {
      const leftDate = toDateLabel(left.session_date);
      const rightDate = toDateLabel(right.session_date);
      const comparedDate = leftDate.localeCompare(rightDate);
      if (comparedDate !== 0) {
        return comparedDate;
      }
      return left.id.localeCompare(right.id);
    });

    const stocks: MopStock[] = [];

    for (const session of sortedSessions) {
      const sessionTickets = await ctx.call<
        Inventory.SessionTicketsInventory[],
        { eid: string; sid: string }
      >(
        'cr7.exhibition.getSessionTickets',
        { eid, sid: session.id },
      );

      const stockByTicketId = new Map(sessionTickets.map(ticket => [ticket.id, ticket.quantity]));
      for (const ticketCategory of ticketCategories) {
        stocks.push({
          otShowId: session.id,
          otSkuId: ticketCategory.id,
          inventoryType: MOP_INVENTORY_TYPE_SHARED,
          stock: stockByTicketId.get(ticketCategory.id) ?? 0,
        });
      }
    }

    const request: MopStockSyncRequest = {
      otProjectId: exhibition.id,
      stocks,
    };

    const privateKey = await readKey(config.mop.private_key_path);
    const publicKey = await readKey(config.mop.public_key_path);

    const syncUrl = new URL('/supply/open/mop/stock/push', config.mop.base_url).toString();

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

  async finishWithMopResponse(
    recordId: string,
    code: number,
    msg: string,
    body: unknown = null,
    syncStatus: Mop.MopOrderSyncStatus = 'FAILED',
    orderId: string | null = null,
    userId: string | null = null,
  ) {
    const schema = await this.getSchema();
    const response = await this.buildMopResponse(code, msg, body);

    await updateMopOrderSyncRecord(this.pool, schema, {
      id: recordId,
      responseBody: body,
      syncStatus,
      orderId,
      userId,
    });

    return response;
  }

  async receiveOrderFromMop(
    ctx: Context<
      { encryptData: string },
      {
        headers?: Record<string, string | string[]>;
        $statusCode?: number;
      }
    >,
  ): Promise<MopResponseEnvelope> {
    ctx.meta.$statusCode = 200;

    const headers = ctx.meta.headers ?? {};
    const signValidation = await this.validateMopSign(headers, MOP_ORDER_URI);
    if (signValidation.ok === false) {
      return signValidation.response;
    }

    const decryptResult = await this.decryptMopRequestBody<MopOrderCreateRequest>(
      ctx.params.encryptData,
    );
    if (decryptResult.ok === false) {
      return decryptResult.response;
    }

    const requestBody = decryptResult.body;
    const schema = await this.getSchema();
    const { id: recordId } = await createMopOrderSyncRecord(this.pool, schema, {
      myOrderId: requestBody.myOrderId ?? null,
      requestPath: MOP_ORDER_URI,
      requestBody,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    const {
      myOrderId,
      projectCode,
      projectShowCode,
      buyerName,
      buyerPhone,
      mobileNoAreaCode,
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
      return this.finishWithMopResponse(recordId, 10001, '参数异常');
    }

    const firstSuccessRecord = await getFirstSuccessfulMopOrderSyncRecordByMyOrderId(
      this.pool,
      schema,
      myOrderId,
    );

    const order = (firstSuccessRecord?.order_id ?? null) === null
      ? null
      : await ctx.call<Order.OrderWithItems, { oid: string }>(
        'cr7.order.get',
        { oid: firstSuccessRecord!.order_id! },
       { meta: { user: { uid: firstSuccessRecord?.user_id } } }
      )
      .then(res => res, (error) => (console.error('Error fetching order:', error), null));

    if (order !== null) {
      const responseBody: MopOrderCreateResponse = {
        myOrderId,
        channelOrderId: order.id,
        payExpiredTime: String(new Date(order.expires_at).getTime()),
      };

      return this.finishWithMopResponse(
        recordId, 10000, '成功',
        responseBody, 'SUCCESS',
        order.id, order.user_id
      );
    }

    const exhibition = await ctx.call<Exhibition.Exhibition | null, { eid: string }>(
      'cr7.exhibition.get',
      { eid: projectCode },
    ).catch(() => null);

    if (!exhibition) {
      return this.finishWithMopResponse(recordId, 30003, '项目状态异常');
    }

    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions',
      { eid: projectCode },
    );
    const session = sessions.find(item => item.id === projectShowCode) ?? null;

    if (!session) {
      return this.finishWithMopResponse(recordId, 30004, '场次状态异常');
    }

    const ticketCategories = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories',
      { eid: projectCode },
    );
    const ticketById = new Map(ticketCategories.map(ticket => [ticket.id, ticket]));

    const totalPriceFromItems = ticketInfo.reduce((sum, item) => sum + Number(item.ticketPrice), 0);
    if (Number(totalPrice).toFixed(2) !== totalPriceFromItems.toFixed(2)) {
      return this.finishWithMopResponse(recordId, 30002, '订单价格不一致');
    }

    const itemCountBySku = new Map<string, number>();
    for (const item of ticketInfo) {
      const ticket = ticketById.get(item.skuId);
      if (!ticket) {
        return this.finishWithMopResponse(recordId, 30005, '票档状态异常');
      }

      const expectedPrice = Number(toYuanString(ticket.price));
      if (Number(item.ticketPrice) !== expectedPrice) {
        return this.finishWithMopResponse(recordId, 30002, '订单价格不一致');
      }

      itemCountBySku.set(item.skuId, (itemCountBySku.get(item.skuId) ?? 0) + 1);
    }

    const userId = await ctx.call<string, { country_code: string; phone: string; name: string }>(
      'user.findOrCreateByPhone',
      {
        country_code: toMopCountryCode(mobileNoAreaCode),
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
        source: 'MOP',
        user_id: userId,
      });

      const responseBody: MopOrderCreateResponse = {
        myOrderId,
        channelOrderId: order.id,
        payExpiredTime: String(new Date(order.expires_at).getTime()),
      };

      return this.finishWithMopResponse(
        recordId, 10000, '成功', responseBody, 'SUCCESS',
        order.id, userId
      );
    } catch (error) {
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === 'INVENTORY_NOT_ENOUGH') {
        return this.finishWithMopResponse(recordId, 30006, '库存不足');
      }

      this.logger.error('处理 MOP 订单同步时发生错误', error);
      return this.finishWithMopResponse(recordId, 10099, '系统异常');
    }
  }

  async queryOrderFromMop(
    ctx: Context<
      { encryptData: string },
      {
        headers?: Record<string, string | string[]>;
        $statusCode?: number;
      }
    >,
  ): Promise<MopResponseEnvelope> {
    ctx.meta.$statusCode = 200;

    const headers = ctx.meta.headers ?? {};
    const signValidation = await this.validateMopSign(headers, MOP_ORDER_QUERY_URI);
    if (signValidation.ok === false) {
      return signValidation.response;
    }

    const decryptResult = await this.decryptMopRequestBody<MopOrderQueryRequest>(
      ctx.params.encryptData,
    );
    if (decryptResult.ok === false) {
      return decryptResult.response;
    }

    const { myOrderId } = decryptResult.body;
    if (!myOrderId) {
      return this.buildMopResponse(10001, '参数异常');
    }

    const schema = await this.getSchema();
    const firstSuccessRecord = await getFirstSuccessfulMopOrderSyncRecordByMyOrderId(
      this.pool,
      schema,
      myOrderId,
    );

    if (firstSuccessRecord?.order_id == null || firstSuccessRecord.user_id == null) {
      return this.buildMopResponse(10001, '参数异常');
    }

    const order = await ctx.call<Order.OrderWithItems, { oid: string }>(
      'cr7.order.get',
      { oid: firstSuccessRecord.order_id },
      { meta: { user: { uid: firstSuccessRecord.user_id } } }
    );

    const redemption = await ctx.call<Redeem.RedemptionCodeWithOrder, { oid: string }>(
      'cr7.redemption.getByOrder',
      { oid: firstSuccessRecord.order_id },
      { meta: { user: { uid: firstSuccessRecord.user_id } } },
    ).then(res => res, () => null);

    const isConsumed = redemption?.status === 'REDEEMED';
    const orderConsumeStatus = isConsumed
      ? MOP_CONSUME_STATUS.CONSUMED
      : MOP_CONSUME_STATUS.NOT_CONSUMED;
    const redeemCode = redemption?.code ?? null;

    const requestBody = firstSuccessRecord.request_body as MopOrderCreateRequest;
    const responseBody: MopOrderQueryResponse = {
      myOrderId,
      fetchCode: null,
      fetchQrCode: null,
      orderStatus: toMopOrderStatus(order.status),
      orderRefundStatus: toMopRefundStatus(order.status),
      orderConsumeStatus,
      ticketInfo: requestBody.ticketInfo.map(item => ({
        myTicketId: item.myTicketId,
        channelTicketId: item.skuId,
        ticketConsumeStatus: orderConsumeStatus,
        checkCode: redeemCode,
        checkQrCode: redeemCode,
      })),
    };

    return this.buildMopResponse(10000, '成功', responseBody);
  }

  async receiveTicketFromMop(
    ctx: Context<
      { encryptData: string },
      {
        headers?: Record<string, string | string[]>;
        $statusCode?: number;
      }
    >,
  ): Promise<MopResponseEnvelope> {
    ctx.meta.$statusCode = 200;

    const headers = ctx.meta.headers ?? {};
    const signValidation = await this.validateMopSign(headers, MOP_TICKET_URI);
    if (signValidation.ok === false) {
      return signValidation.response;
    }

    const decryptResult = await this.decryptMopRequestBody<MopTicketConfirmationRequest>(
      ctx.params.encryptData,
    );
    if (decryptResult.ok === false) {
      return decryptResult.response;
    }

    const ticketRequestBody = decryptResult.body;
    const { myOrderId } = ticketRequestBody;
    if (!myOrderId) {
      return this.buildMopResponse(10001, '参数异常');
    }

    const schema = await this.getSchema();

    const { id: recordId } = await createMopOrderSyncRecord(this.pool, schema, {
      myOrderId,
      requestPath: MOP_TICKET_URI,
      requestBody: ticketRequestBody,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    const firstSuccessRecord = await getFirstSuccessfulMopOrderSyncRecordByMyOrderId(
      this.pool,
      schema,
      myOrderId,
    );

    if (firstSuccessRecord?.order_id == null || firstSuccessRecord.user_id == null) {
      return this.finishWithMopResponse(recordId, 10001, '参数异常');
    }

    await ctx.call<{ paid_at: Date }, { oid: string }>(
      'cr7.order.markPaid',
      { oid: firstSuccessRecord.order_id },
    );

    const order = await ctx.call<Order.OrderWithItems, { oid: string }>(
      'cr7.order.get',
      { oid: firstSuccessRecord.order_id },
      { meta: { user: { uid: firstSuccessRecord.user_id } } }
    );

    const redemption = await ctx.call<Redeem.RedemptionCodeWithOrder, { oid: string }>(
      'cr7.redemption.getByOrder',
      { oid: firstSuccessRecord.order_id },
      { meta: { user: { uid: firstSuccessRecord.user_id } } },
    ).then(res => res, () => null);
    const redeemCode = redemption?.code ?? null;

    const requestBody = firstSuccessRecord.request_body as MopOrderCreateRequest;
    const responseBody: MopTicketConfirmationResponse = {
      myOrderId,
      fetchCode: null,
      fetchQrCode: null,
      orderStatus: toMopOrderStatus(order.status),
      ticketInfo: requestBody.ticketInfo.map(item => ({
        myTicketId: item.myTicketId,
        channelTicketId: item.skuId,
        checkCode: redeemCode,
        checkQrCode: redeemCode,
      })),
    };

    return this.finishWithMopResponse(
      recordId,
      10000,
      '成功',
      responseBody,
      'SUCCESS',
      order.id,
      firstSuccessRecord.user_id,
    );
  }

  async receiveOrderStatusChangeFromMop(
    ctx: Context<
      { encryptData: string },
      {
        headers?: Record<string, string | string[]>;
        $statusCode?: number;
      }
    >,
  ): Promise<MopResponseEnvelope> {
    ctx.meta.$statusCode = 200;

    const headers = ctx.meta.headers ?? {};
    const signValidation = await this.validateMopSign(headers, MOP_ORDER_STATUS_CHANGE_URI);
    if (signValidation.ok === false) {
      return signValidation.response;
    }

    const decryptResult = await this.decryptMopRequestBody<MopOrderStatusChangeRequest>(
      ctx.params.encryptData,
    );
    if (decryptResult.ok === false) {
      return decryptResult.response;
    }

    const requestBody = decryptResult.body;
    const schema = await this.getSchema();
    const { myOrderId, bizType } = requestBody;
    if (!myOrderId
      || (
        bizType !== MOP_ORDER_STATUS_CHANGE_BIZ_TYPE_CANCEL
        && bizType !== MOP_ORDER_STATUS_CHANGE_BIZ_TYPE_REFUND
      )
    ) {
      return this.buildMopResponse(10001, '参数异常');
    }

    const { id: recordId } = await createMopOrderSyncRecord(this.pool, schema, {
      myOrderId: requestBody.myOrderId ?? null,
      requestPath: MOP_ORDER_STATUS_CHANGE_URI,
      requestBody,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    const firstSuccessRecord = await getFirstSuccessfulMopOrderSyncRecordByMyOrderId(
      this.pool,
      schema,
      myOrderId,
    );

    if (firstSuccessRecord?.order_id == null || firstSuccessRecord.user_id == null) {
      return this.finishWithMopResponse(recordId, 10001, '参数异常');
    }

    try {
      if (bizType === MOP_ORDER_STATUS_CHANGE_BIZ_TYPE_CANCEL) {
        await ctx.call(
          'cr7.order.cancel',
          { oid: firstSuccessRecord.order_id },
          { meta: { user: { uid: firstSuccessRecord.user_id } } },
        );
      } else if (bizType === MOP_ORDER_STATUS_CHANGE_BIZ_TYPE_REFUND) {
        await ctx.call(
          'cr7.order.markRefunded',
          { oid: firstSuccessRecord.order_id },
        );
      }
      ctx.meta.$statusCode = 200;
    } catch (error) {
      this.logger.error('处理 MOP 订单状态变更通知时发生错误', error);
      return this.finishWithMopResponse(
        recordId, 10099,
        (error as Error).message || '系统异常'
      );
    }

    return this.finishWithMopResponse(
      recordId,
      10000,
      '成功',
      null,
      'SUCCESS',
      firstSuccessRecord.order_id,
      firstSuccessRecord.user_id,
    );
  }

  async getMopOrderRecord(
    ctx: Context<{ rid: string }, UserMeta>,
  ): Promise<Mop.MopOrderSyncRecord[]> {
    const { rid } = ctx.params;
    const schema = await this.getSchema();

    return listMopOrderSyncRecordsByOrderId(this.pool, schema, rid);
  }

  async notifyOrderConsumed(
    ctx: Context<{ oid: string }>,
  ): Promise<void> {
    const { oid } = ctx.params;
    const schema = await this.getSchema();

    const record = await getSuccessfulOrderCreateRecordByOrderId(this.pool, schema, oid);
    if (!record) {
      throw new MoleculerClientError(
        `No successful MOP order create record found for order ${oid}`,
        404,
        'MOP_ORDER_RECORD_NOT_FOUND'
      );
    }

    const requestBody = record.request_body as MopOrderCreateRequest;
    const consumeBody = {
      myOrderId: record.my_order_id,
      ticketInfo: requestBody.ticketInfo.map(t => t.myTicketId),
    };

    const privateKey = await readKey(config.mop.private_key_path);
    const publicKey = await readKey(config.mop.public_key_path);
    const consumeUrl = new URL(MOP_CONSUME_URI, config.mop.base_url).toString();

    await mopPostJSON(consumeUrl, {
      supplier: config.mop.supplier,
      aesKey: config.mop.aes_key,
      privateKey,
      responsePublicKey: publicKey,
      body: consumeBody,
    });
  }
}
