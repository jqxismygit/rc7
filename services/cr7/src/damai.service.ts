import config from 'config';
import { randomUUID } from 'node:crypto';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Damai, Exhibition, Order, Redeem } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { buildDamaiSignature, damaiPostJson, verifyDamaiSignature } from './libs/damai.js';
import {
  createDamaiOrderSyncRecord,
  getFirstSuccessfulDamaiOrderSyncRecordByDamaiOrderId,
  listDamaiOrderSyncRecordsByOrderId,
  updateDamaiOrderSyncRecord,
} from './data/damai.js';
import { getExhibitionById, getSessionById } from './data/exhibition.js';

const { MoleculerClientError } = Errors;

interface Meta {
  $statusCode?: number;
}

interface UserMeta {
  uid: string;
}

type DamaiHeadPayload = {
  version: string;
  msgId: string;
  apiKey: string;
  apiSecret: string;
  timestamp: string;
  signed: string;
};

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
  tTypeAndDMethod: Record<string, number[]>;
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

type DamaiSubmitOrderCommodityInfo = {
  priceId: string;
  seatId?: string;
  subOrderId: string;
  packageId?: string;
};

type DamaiSubmitOrderPriceInfo = {
  priceId: string;
  num: number | string;
  price: number;
  type?: number;
};

type DamaiSubmitOrderUserInfo = {
  userId: string;
  name?: string;
  mobile?: string;
};

type DamaiCreateOrderRequest = {
  head: DamaiHeadPayload;
  bodySubmitOrder: {
    orderInfo: {
      daMaiOrderId: string;
      projectId: string;
      performId: string;
      hasSeat: boolean;
      commodityInfoList: DamaiSubmitOrderCommodityInfo[];
      priceInfo: DamaiSubmitOrderPriceInfo[];
      userInfo: DamaiSubmitOrderUserInfo;
      totalAmountFen: number;
      realAmountOfFen: number;
      expressFee?: number;
    };
  };
};

type DamaiCreateOrderResponse = {
  head: {
    returnCode: string;
    returnDesc: string;
  };
  body: {
    orderInfo: {
      orderId?: string;
      totalAmount?: number;
      realAmount?: number;
      expressFee?: number;
    };
  };
};

type DamaiPayOrderRequest = {
  head: DamaiHeadPayload;
  bodyPayOrder: {
    orderInfo: {
      daMaiOrderId: string;
    };
  };
};

type DamaiPayOrderResponse = {
  head: {
    returnCode: string;
    returnDesc: string;
  };
  body: {
    orderPayInfo: {
      thirdOrderId?: string;
      daMaiOrderId?: string;
      payStatus?: number;
    };
  };
};

type DamaiCancelOrderRequest = {
  head: DamaiHeadPayload;
  cancelOrderInfo: {
    orderId: string;
  };
};

type DamaiCancelOrderResponse = {
  head: {
    returnCode: string;
    returnDesc: string;
  };
};

type DamaiRefundApplyInfo = {
  daMaiOrderId: string;
  orderId: string;
  refundId: string;
  refundReason: string;
  refundAmountFen: number;
};

type DamaiRefundApplyRequest = {
  head: DamaiHeadPayload;
  bodyRefundApply: {
    refundInfo: DamaiRefundApplyInfo;
  };
};

type DamaiRefundApplyResponse = {
  head: {
    returnCode: string;
    returnDesc: string;
  };
};

type DamaiGetETicketInfoRequest = {
  head: DamaiHeadPayload;
  bodyGetESeatInfo: {
    daMaiUserId?: string;
    orderId: string;
  };
};

type DamaiGetETicketInfo = {
  aoDetailId: string;
  certType: number;
  hasSeat: boolean;
  price: number;
  priceId: string;
  qrcodeType: number;
  qrCode: string;
  exchangeCode: string;
  seatByNumber: boolean;
};

type DamaiGetETicketInfoResponse = {
  head: {
    returnCode: string;
    returnDesc: string;
  };
  body: {
    bodyGetESeatInfo: {
      projectName?: string;
      showTime?: number;
      venueName?: string;
      eticketInfos: DamaiGetETicketInfo[];
    };
  };
};

type DamaiValidatedCreateOrderInfo = {
  daMaiOrderId: string;
  projectId: string;
  performId: string;
  commodityInfoList: DamaiSubmitOrderCommodityInfo[];
  priceInfo: DamaiSubmitOrderPriceInfo[];
  userInfo: DamaiSubmitOrderUserInfo;
  totalAmountFen: number;
  realAmountOfFen: number;
};

type ExhibitionSessionTicket = Exhibition.TicketCategory & {
  session_id: string;
  quantity: number;
};

const DAMAI_PERFORM_STATUS_ENABLED = 1;
const DAMAI_TICKET_TYPE_ELECTRONIC = 2;
const DAMAI_RULE_TYPE_NON_REAL_NAME = 0;
const DAMAI_TICKET_SALE_STATE_ON_SALE = 1;
const DAMAI_CREATE_ORDER_URI = '/damai/createOrder';
const DAMAI_PAY_CALLBACK_URI = '/damai/payCallBack';
const DAMAI_CANCEL_ORDER_URI = '/damai/cancelOrder';
const DAMAI_REFUND_APPLY_URI = '/damai/refundApply';
const DAMAI_PAY_STATUS_SUCCESS = 1;
const DAMAI_VALIDATE_URI = '/b2b2c/2.0/sync/validate';
const DAMAI_VALIDATE_STATUS_VALIDATED = 2;
const DAMAI_CERT_TYPE_NON_REAL_NAME = 0;
const DAMAI_QRCODE_TYPE_STATIC = 1;

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

function buildDamaiCreateOrderError(returnCode: string, returnDesc: string): DamaiCreateOrderResponse {
  return {
    head: {
      returnCode,
      returnDesc,
    },
    body: {
      orderInfo: {},
    },
  };
}

function buildDamaiCreateOrderSuccess(input: {
  orderId: string;
  totalAmount: number;
  realAmount: number;
  expressFee?: number;
}): DamaiCreateOrderResponse {
  return {
    head: {
      returnCode: '0',
      returnDesc: '成功',
    },
    body: {
      orderInfo: {
        orderId: input.orderId,
        totalAmount: input.totalAmount,
        realAmount: input.realAmount,
        expressFee: input.expressFee ?? 0,
      },
    },
  };
}

function isValidDamaiHead(head: DamaiHeadPayload): boolean {
  if (head.apiKey !== config.damai.api_key) {
    return false;
  }

  const expected = buildDamaiSignature({
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
    msgId: head.msgId,
    timestamp: head.timestamp,
    version: head.version,
  });

  if (head.apiSecret !== expected.apiSecret) {
    return false;
  }

  return verifyDamaiSignature(head.signed, {
    apiKey: config.damai.api_key,
    apiPw: config.damai.api_pwd,
    msgId: head.msgId,
    timestamp: head.timestamp,
    version: head.version,
  });
}

function buildDamaiPayOrderError(returnCode: string, returnDesc: string): DamaiPayOrderResponse {
  return {
    head: {
      returnCode,
      returnDesc,
    },
    body: {
      orderPayInfo: {},
    },
  };
}

function buildDamaiPayOrderSuccess(input: {
  orderId: string;
  daMaiOrderId: string;
}): DamaiPayOrderResponse {
  return {
    head: {
      returnCode: '0',
      returnDesc: '成功',
    },
    body: {
      orderPayInfo: {
        thirdOrderId: input.orderId,
        daMaiOrderId: input.daMaiOrderId,
        payStatus: DAMAI_PAY_STATUS_SUCCESS,
      },
    },
  };
}

function buildDamaiCancelOrderError(returnCode: string, returnDesc: string): DamaiCancelOrderResponse {
  return {
    head: {
      returnCode,
      returnDesc,
    },
  };
}

function buildDamaiCancelOrderSuccess(): DamaiCancelOrderResponse {
  return {
    head: {
      returnCode: '0',
      returnDesc: '取消订单成功',
    },
  };
}

function buildDamaiRefundApplyError(returnCode: string, returnDesc: string): DamaiRefundApplyResponse {
  return {
    head: {
      returnCode,
      returnDesc,
    },
  };
}

function buildDamaiRefundApplySuccess(): DamaiRefundApplyResponse {
  return {
    head: {
      returnCode: '0',
      returnDesc: '成功',
    },
  };
}

function toDamaiTimestamp(sessionDate: string | Date, time: string): number {
  const label = `${toDateLabel(sessionDate)} ${normalizeTimeLabel(time)}`;
  const parsed = parse(label, 'yyyy-MM-dd HH:mm:ss', new Date());
  return parsed.getTime();
}

function buildDamaiGetETicketInfoError(returnCode: string, returnDesc: string): DamaiGetETicketInfoResponse {
  return {
    head: {
      returnCode,
      returnDesc,
    },
    body: {
      bodyGetESeatInfo: {
        eticketInfos: [],
      },
    },
  };
}

function buildDamaiGetETicketInfoSuccess(input: {
  projectName: string;
  showTime: number;
  venueName: string;
  eticketInfos: DamaiGetETicketInfo[];
}): DamaiGetETicketInfoResponse {
  return {
    head: {
      returnCode: '0',
      returnDesc: '成功',
    },
    body: {
      bodyGetESeatInfo: {
        projectName: input.projectName,
        showTime: input.showTime,
        venueName: input.venueName,
        eticketInfos: input.eticketInfos,
      },
    },
  };
}

class DamaiService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'damai',
      settings: {
        $noVersionPrefix: true,
      },
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
        createOrderFromDamai: {
          rest: 'POST /createOrder',
          params: {
            head: 'object',
            bodySubmitOrder: 'object',
          },
          handler: this.createOrderFromDamai,
        },
        payOrderFromDamai: {
          rest: 'POST /payCallBack',
          params: {
            head: 'object',
            bodyPayOrder: 'object',
          },
          handler: this.payOrderFromDamai,
        },
        cancelOrderFromDamai: {
          rest: 'POST /cancelOrder',
          params: {
            head: 'object',
            cancelOrderInfo: 'object',
          },
          handler: this.cancelOrderFromDamai,
        },
        refundApplyFromDamai: {
          rest: 'POST /refundApply',
          params: {
            head: 'object',
            bodyRefundApply: 'object',
          },
          handler: this.refundApplyFromDamai,
        },
        getETicketInfoFromDamai: {
          rest: 'POST /getSeatInfo',
          params: {
            head: 'object',
            bodyGetESeatInfo: 'object',
          },
          handler: this.getETicketInfoFromDamai,
        },
        getDamaiOrderRecord: {
          rest: 'GET /orders/:rid',
          roles: ['admin'],
          params: {
            rid: 'uuid',
          },
          handler: this.getDamaiOrderRecord,
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

  async syncExhibitionToDamai(ctx: Context<{ eid: string }, Meta>): Promise<void> {
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
      sign: config.damai.sign,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async syncSessionsToDamai(
    ctx: Context<{ eid: string; start_session_date?: Date; end_session_date?: Date }, Meta>
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
        tTypeAndDMethod: {
          [`${DAMAI_TICKET_TYPE_ELECTRONIC}`]: [DAMAI_TICKET_TYPE_ELECTRONIC],
        },
        ruleType: DAMAI_RULE_TYPE_NON_REAL_NAME,
      })),
    };

    const syncUrl = new URL('/b2b2c/2.0/sync/perform', config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      sign: config.damai.sign,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async syncTicketsToDamai(
    ctx: Context<{ eid: string; sid: string }, Meta>
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
      sign: config.damai.sign,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async finishWithDamaiResponse<
    T extends DamaiCreateOrderResponse | DamaiPayOrderResponse | DamaiCancelOrderResponse | DamaiRefundApplyResponse
  >(
    recordId: string,
    response: T,
    syncStatus: Damai.DamaiOrderSyncStatus = 'FAILED',
    orderId?: string,
    userId?: string,
  ): Promise<T> {
    const schema = await this.getSchema();

    await updateDamaiOrderSyncRecord(this.pool, schema, {
      id: recordId,
      responseBody: response,
      syncStatus,
      orderId: orderId ?? null,
      userId: userId ?? null,
    });

    return response;
  }

  async createOrderFromDamai(
    ctx: Context<DamaiCreateOrderRequest, Meta>,
  ): Promise<DamaiCreateOrderResponse> {
    ctx.meta.$statusCode = 200;

    const payload = ctx.params;
    const schema = await this.getSchema();

    const { id: recordId } = await createDamaiOrderSyncRecord(this.pool, schema, {
      damaiOrderId: payload.bodySubmitOrder?.orderInfo?.daMaiOrderId ?? null,
      requestPath: DAMAI_CREATE_ORDER_URI,
      requestBody: payload,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    if (isValidDamaiHead(payload.head) === false) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20000', '签名错误'));
    }

    const {
      daMaiOrderId,
      projectId,
      performId,
      commodityInfoList,
      priceInfo,
      userInfo,
      totalAmountFen,
      realAmountOfFen,
    } = payload.bodySubmitOrder?.orderInfo ?? {} as DamaiValidatedCreateOrderInfo;

    if (
      !daMaiOrderId ||
      !projectId ||
      !performId ||
      !userInfo?.userId ||
      !Array.isArray(commodityInfoList) ||
      commodityInfoList.length === 0 ||
      !Array.isArray(priceInfo) ||
      priceInfo.length === 0 ||
      typeof totalAmountFen !== 'number' ||
      typeof realAmountOfFen !== 'number'
    ) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20001', '参数异常'));
    }

    const firstSuccessRecord = await getFirstSuccessfulDamaiOrderSyncRecordByDamaiOrderId(
      this.pool,
      schema,
      daMaiOrderId,
    );

    if (firstSuccessRecord?.order_id) {
      const previousResponse = firstSuccessRecord.response_body as DamaiCreateOrderResponse | undefined;
      const response = previousResponse?.head?.returnCode === '0'
        ? previousResponse
        : buildDamaiCreateOrderSuccess({
          orderId: firstSuccessRecord.order_id,
          totalAmount: totalAmountFen,
          realAmount: realAmountOfFen,
        });

      return this.finishWithDamaiResponse(
        recordId,
        response,
        'SUCCESS',
        firstSuccessRecord.order_id,
        firstSuccessRecord.user_id,
      );
    }

    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get',
      { eid: projectId },
    ).catch(() => null);
    if (!exhibition) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20015', '项目状态异常'));
    }

    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions',
      { eid: projectId },
    );
    const session = sessions.find(item => item.id === performId) ?? null;
    if (!session) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20013', '场次状态异常'));
    }

    const tickets = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories',
      { eid: projectId },
    );
    const ticketById = new Map(tickets.map(ticket => [ticket.id, ticket]));

    for (const commodity of commodityInfoList) {
      if (!commodity.priceId || !commodity.subOrderId) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20001', '参数异常'));
      }

      if (!ticketById.has(commodity.priceId)) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20015', '票档状态异常'));
      }
    }

    let calculatedTotalAmountFen = 0;
    const itemCountBySku = new Map<string, number>();
    for (const item of priceInfo) {
      const quantity = typeof item.num === 'string' ? Number(item.num) : item.num;
      if (!item || !item.priceId || !Number.isInteger(quantity) || quantity <= 0) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20001', '参数异常'));
      }

      const ticket = ticketById.get(item.priceId);
      if (!ticket) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20015', '票档状态异常'));
      }

      const expectedPriceInCent = ticket.price;
      if (item.price !== expectedPriceInCent) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20014', '订单价格不一致'));
      }

      calculatedTotalAmountFen += item.price * quantity;
      itemCountBySku.set(item.priceId, (itemCountBySku.get(item.priceId) ?? 0) + quantity);
    }

    if (calculatedTotalAmountFen !== totalAmountFen || realAmountOfFen !== totalAmountFen) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20014', '订单价格不一致'));
    }

    const userId = await ctx.call<string, { damai_user_id: string; name: string }>(
      'user.findOrCreateByDamaiId',
      {
        damai_user_id: userInfo.userId,
        name: userInfo.name?.trim() || userInfo.userId,
      }
    );

    try {
      const order = await ctx.call<Order.OrderWithItems, {
        eid: string;
        sid: string;
        items: Order.CreateOrderItem[];
        source: Order.OrderSource;
        user_id: string;
      }>('cr7.order.create', {
        eid: projectId,
        sid: performId,
        items: Array.from(itemCountBySku.entries()).map(([ticket_category_id, quantity]) => ({
          ticket_category_id,
          quantity,
        })),
        source: 'DAMAI',
        user_id: userId,
      });

      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiCreateOrderSuccess({
          orderId: order.id,
          totalAmount: totalAmountFen,
          realAmount: realAmountOfFen,
        }),
        'SUCCESS',
        order.id,
        userId,
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'INVENTORY_NOT_ENOUGH') {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20010', '库存不足'));
      }

      this.logger.error('处理大麦订单同步时发生错误', error);
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('20015', '系统异常'));
    }
  }

  async payOrderFromDamai(
    ctx: Context<DamaiPayOrderRequest, Meta>,
  ): Promise<DamaiPayOrderResponse> {
    ctx.meta.$statusCode = 200;

    const payload = ctx.params;
    const schema = await this.getSchema();

    const { id: recordId } = await createDamaiOrderSyncRecord(this.pool, schema, {
      damaiOrderId: payload.bodyPayOrder?.orderInfo?.daMaiOrderId ?? null,
      requestPath: DAMAI_PAY_CALLBACK_URI,
      requestBody: payload,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    if (isValidDamaiHead(payload.head) === false) {
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('20000', '签名错误'));
    }

    const daMaiOrderId = payload.bodyPayOrder?.orderInfo?.daMaiOrderId;
    if (!daMaiOrderId) {
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('20001', '参数异常'));
    }

    const firstSuccessRecord = await getFirstSuccessfulDamaiOrderSyncRecordByDamaiOrderId(
      this.pool,
      schema,
      daMaiOrderId,
    );

    if (firstSuccessRecord?.order_id == null || firstSuccessRecord.user_id == null) {
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('20020', '订单不存在'));
    }

    try {
      await ctx.call<{ paid_at: Date }, { oid: string }>(
        'cr7.order.markPaid',
        { oid: firstSuccessRecord.order_id },
      );

      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiPayOrderSuccess({
          orderId: firstSuccessRecord.order_id,
          daMaiOrderId,
        }),
        'SUCCESS',
        firstSuccessRecord.order_id,
        firstSuccessRecord.user_id,
      );
    } catch (error) {
      const code = (error as { code?: string }).code;

      if (code === 'ORDER_NOT_FOUND') {
        return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('20020', '订单不存在'));
      }

      if (code === 'ORDER_STATUS_INVALID') {
        return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('20021', '订单状态异常'));
      }

      this.logger.error('处理大麦订单支付回调时发生错误', error);
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('20024', '系统异常'));
    }
  }

  async cancelOrderFromDamai(
    ctx: Context<DamaiCancelOrderRequest, Meta>,
  ): Promise<DamaiCancelOrderResponse> {
    ctx.meta.$statusCode = 200;

    const payload = ctx.params;
    const schema = await this.getSchema();

    const { id: recordId } = await createDamaiOrderSyncRecord(this.pool, schema, {
      damaiOrderId: null,
      requestPath: DAMAI_CANCEL_ORDER_URI,
      requestBody: payload,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    if (isValidDamaiHead(payload.head) === false) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCancelOrderError('20000', '签名错误'));
    }

    const orderId = payload.cancelOrderInfo?.orderId;
    if (!orderId) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCancelOrderError('20001', '参数异常'));
    }

    const order = await ctx.call(
      'cr7.order.getAdmin', { oid: orderId }, { meta: { roles: ['admin'] } }
    )
    .then((res) => res as Order.OrderWithItems, () => null);
    if (!order) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCancelOrderError('20040', '取消订单失败 -- 订单不存在'));
    }

    if (order.status === 'CANCELLED') {
      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiCancelOrderSuccess(),
        'SUCCESS',
        order.id,
        order.user_id,
      );
    }

    try {
      await ctx.call(
        'cr7.order.cancel',
        { oid: order.id },
        { meta: { user: { uid: order.user_id } } },
      );

      // Nested cr7.order.cancel sets $statusCode=204; reset to 200 for Damai callback JSON response.
      ctx.meta.$statusCode = 200;

      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiCancelOrderSuccess(),
        'SUCCESS',
        order.id,
        order.user_id,
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ORDER_STATUS_INVALID') {
        return this.finishWithDamaiResponse(
          recordId,
          buildDamaiCancelOrderError('20040', '取消订单失败 -- 订单状态异常'),
          'FAILED',
          order.id,
          order.user_id,
        );
      }

      this.logger.error('处理大麦订单取消回调时发生错误', error);
      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiCancelOrderError('20040', '取消订单失败 -- 系统异常'),
        'FAILED',
        order.id,
        order.user_id,
      );
    }
  }

  async refundApplyFromDamai(
    ctx: Context<DamaiRefundApplyRequest, Meta>,
  ): Promise<DamaiRefundApplyResponse> {
    ctx.meta.$statusCode = 200;

    const payload = ctx.params;
    const schema = await this.getSchema();
    const damaiOrderId = payload.bodyRefundApply?.refundInfo?.daMaiOrderId ?? null;

    const { id: recordId } = await createDamaiOrderSyncRecord(this.pool, schema, {
      damaiOrderId,
      requestPath: DAMAI_REFUND_APPLY_URI,
      requestBody: payload,
      responseBody: null,
      syncStatus: 'FAILED',
      orderId: null,
    });

    if (isValidDamaiHead(payload.head) === false) {
      return this.finishWithDamaiResponse(recordId, buildDamaiRefundApplyError('20000', '签名错误'));
    }

    const refundInfo = payload.bodyRefundApply?.refundInfo;
    const orderId = refundInfo?.orderId;
    const refundId = refundInfo?.refundId;
    const refundAmountFen = refundInfo?.refundAmountFen;
    if (
      !refundInfo
      || !refundInfo.daMaiOrderId
      || !orderId
      || !refundId
      || !refundInfo.refundReason
      || typeof refundAmountFen !== 'number'
      || refundAmountFen < 0
    ) {
      return this.finishWithDamaiResponse(recordId, buildDamaiRefundApplyError('20001', '参数异常'));
    }

    const order = await ctx.call(
      'cr7.order.getAdmin', { oid: orderId }, { meta: { roles: ['admin'] } }
    )
    .then((res) => res as Order.OrderWithItems, () => null);
    if (!order) {
      return this.finishWithDamaiResponse(recordId, buildDamaiRefundApplyError('20050', '退款失败--订单不存在'));
    }

    if (refundAmountFen !== order.total_amount) {
      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiRefundApplyError('20051', '退款金额不一致'),
        'FAILED',
        order.id,
        order.user_id,
      );
    }

    try {
      const outRefundNo = randomUUID().replace(/-/g, '');

      await ctx.call(
        'cr7.payment.refund',
        {
          oid: order.id,
          payment_method: 'DAMAI' as const,
          out_trade_no: refundInfo.daMaiOrderId,
          out_refund_no: outRefundNo,
          reason: refundInfo.refundReason,
          refund_amount: refundAmountFen,
        },
        { meta: { user: { uid: order.user_id } } }
      );

      await ctx.call(
        'cr7.payment.updateRefundResult',
        {
          out_refund_no: outRefundNo,
          refund_status: 'SUCCESS',
          refund_id: refundId,
          succeeded_at: new Date().toISOString(),
        },
      );

      await ctx.call('cr7.order.markRefunded', { oid: order.id });

      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiRefundApplySuccess(),
        'SUCCESS',
        order.id,
        order.user_id,
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'ORDER_STATUS_INVALID') {
        return this.finishWithDamaiResponse(
          recordId,
          buildDamaiRefundApplyError('20050', '退款失败--订单状态异常'),
          'FAILED',
          order.id,
          order.user_id,
        );
      }

      this.logger.error('处理大麦订单退款申请时发生错误', error);
      return this.finishWithDamaiResponse(
        recordId,
        buildDamaiRefundApplyError('20054', '退款失败--系统异常'),
        'FAILED',
        order.id,
        order.user_id,
      );
    }
  }

  async getETicketInfoFromDamai(
    ctx: Context<DamaiGetETicketInfoRequest, Meta>,
  ): Promise<DamaiGetETicketInfoResponse> {
    ctx.meta.$statusCode = 200;

    const payload = ctx.params;
    if (isValidDamaiHead(payload.head) === false) {
      return buildDamaiGetETicketInfoError('10001', '签名错误');
    }

    const orderId = payload.bodyGetESeatInfo?.orderId;
    if (!orderId) {
      return buildDamaiGetETicketInfoError('10001', '参数异常');
    }

    const schema = await this.getSchema();
    const order = await ctx.call(
      'cr7.order.getAdmin', { oid: orderId }, { meta: { roles: ['admin'] } }
    )
    .then((res) => res as Order.OrderWithItems, () => null);
    if (!order) {
      return buildDamaiGetETicketInfoError('20030', '订单不存在');
    }

    if (order.status !== 'PAID') {
      return buildDamaiGetETicketInfoError('20030', '订单未支付');
    }

    const [exhibition, session, redemption] = await Promise.all([
      getExhibitionById(this.pool, schema, order.exhibit_id).catch(() => null),
      getSessionById(this.pool, schema, order.session_id).catch(() => null),
      ctx.call<Redeem.RedemptionCodeWithOrder, { oid: string }>(
        'cr7.redemption.getByOrder',
        { oid: order.id },
        { meta: { user: { uid: order.user_id } } },
      ).catch(() => null),
    ]);

    if (!exhibition || !session || !redemption?.code) {
      return buildDamaiGetETicketInfoError('20030', '获取电子票失败');
    }

    const eticketInfos = order.items.flatMap(item => Array.from({ length: item.quantity }, () => ({
      aoDetailId: item.id,
      certType: DAMAI_CERT_TYPE_NON_REAL_NAME,
      hasSeat: false,
      price: item.unit_price,
      priceId: item.ticket_category_id,
      qrcodeType: DAMAI_QRCODE_TYPE_STATIC,
      qrCode: redemption.code,
      exchangeCode: redemption.code,
      seatByNumber: false,
    })));

    return buildDamaiGetETicketInfoSuccess({
      projectName: exhibition.name,
      venueName: exhibition.venue_name,
      showTime: toDamaiTimestamp(session.session_date, exhibition.opening_time),
      eticketInfos,
    });
  }

  async notifyOrderConsumed(
    ctx: Context<{ oid: string; redeemed_at: string }>,
  ): Promise<void> {
    const { oid, redeemed_at } = ctx.params;
    const schema = await this.getSchema();

    const records = await listDamaiOrderSyncRecordsByOrderId(this.pool, schema, oid);
    const createRecord = records.find(
      r => r.request_path === DAMAI_CREATE_ORDER_URI && r.sync_status === 'SUCCESS',
    );
    if (!createRecord) {
      throw new MoleculerClientError(`No successful create order record found for order ${oid}`, 404, 'RECORD_NOT_FOUND');
    }

    const createRequest = createRecord.request_body as DamaiCreateOrderRequest;
    const daMaiOrderId = createRequest.bodySubmitOrder?.orderInfo?.daMaiOrderId;
    if (!daMaiOrderId) {
      throw new MoleculerClientError(`No daMaiOrderId found for order ${oid}`, 404, 'RECORD_NOT_FOUND');
    }

    const order = await ctx.call(
      'cr7.order.getAdmin', { oid }, { meta: { roles: ['admin'] } }
    )
    .then((res) => res as Order.OrderWithItems, () => null);
    if (!order) {
      throw new MoleculerClientError(`No order access context found for order ${oid}`, 404, 'ORDER_NOT_FOUND');
    }

    const validateVoucherRequestList = order.items.flatMap(item =>
      Array.from({ length: item.quantity }, () => ({
        aoDetailId: item.id,
        validateStatus: DAMAI_VALIDATE_STATUS_VALIDATED,
        validateCount: 1,
        validateTime: formatDamaiDateTime(redeemed_at),
      }))
    );

    const body = {
      cOrderId: daMaiOrderId,
      vendorOrderId: oid,
      validateVoucherRequestList,
    };

    const syncUrl = new URL(DAMAI_VALIDATE_URI, config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      sign: config.damai.sign,
      body,
    });
  }

  async getDamaiOrderRecord(
    ctx: Context<{ rid: string }, UserMeta>,
  ): Promise<Damai.DamaiOrderSyncRecord[]> {
    const { rid } = ctx.params;
    const schema = await this.getSchema();

    return listDamaiOrderSyncRecordsByOrderId(this.pool, schema, rid);
  }
}

export default DamaiService;
