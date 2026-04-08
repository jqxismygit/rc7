import config from 'config';
import { format, isDate, parse, parseISO } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Damai, Exhibition, Order } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { buildDamaiSignature, damaiPostJson, verifyDamaiSignature } from './libs/damai.js';
import {
  createDamaiOrderSyncRecord,
  getFirstSuccessfulDamaiOrderSyncRecordByDamaiOrderId,
  listDamaiOrderSyncRecordsByOrderId,
  updateDamaiOrderSyncRecord,
} from './data/damai.js';

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
const DAMAI_PAY_STATUS_SUCCESS = 1;

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
        getDamaiOrderRecord: {
          rest: 'GET /orders/:rid',
          roles: ['admin'],
          params: {
            rid: 'uuid',
          },
          handler: this.getDamaiOrderRecord,
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
      apiKey: config.damai.api_key,
      sign: config.damai.sign,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
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
        ticketTypeAndDeliveryMethod: {
          [DAMAI_TICKET_TYPE_ELECTRONIC]: [DAMAI_TICKET_TYPE_ELECTRONIC],
        },
        ruleType: DAMAI_RULE_TYPE_NON_REAL_NAME,
      })),
    };

    const syncUrl = new URL('/b2b2c/2.0/sync/perform', config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      apiKey: config.damai.api_key,
      sign: config.damai.sign,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
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
      apiKey: config.damai.api_key,
      sign: config.damai.sign,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }

  async finishWithDamaiResponse<T extends DamaiCreateOrderResponse | DamaiPayOrderResponse>(
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
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('10001', '签名错误'));
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
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('10001', '参数异常'));
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
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30003', '项目状态异常'));
    }

    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions',
      { eid: projectId },
    );
    const session = sessions.find(item => item.id === performId) ?? null;
    if (!session) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30004', '场次状态异常'));
    }

    const tickets = await ctx.call<Exhibition.TicketCategory[], { eid: string }>(
      'cr7.exhibition.getTicketCategories',
      { eid: projectId },
    );
    const ticketById = new Map(tickets.map(ticket => [ticket.id, ticket]));

    for (const commodity of commodityInfoList) {
      if (!commodity.priceId || !commodity.subOrderId) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('10001', '参数异常'));
      }

      if (!ticketById.has(commodity.priceId)) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30005', '票档状态异常'));
      }
    }

    let calculatedTotalAmountFen = 0;
    const itemCountBySku = new Map<string, number>();
    for (const item of priceInfo) {
      const quantity = typeof item.num === 'string' ? Number(item.num) : item.num;
      if (!item || !item.priceId || !Number.isInteger(quantity) || quantity <= 0) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('10001', '参数异常'));
      }

      const ticket = ticketById.get(item.priceId);
      if (!ticket) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30005', '票档状态异常'));
      }

      const expectedPriceInCent = ticket.price * 100;
      if (item.price !== expectedPriceInCent) {
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30002', '订单价格不一致'));
      }

      calculatedTotalAmountFen += item.price * quantity;
      itemCountBySku.set(item.priceId, (itemCountBySku.get(item.priceId) ?? 0) + quantity);
    }

    if (calculatedTotalAmountFen !== totalAmountFen || realAmountOfFen !== totalAmountFen) {
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30002', '订单价格不一致'));
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
        return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('30006', '库存不足'));
      }

      this.logger.error('处理大麦订单同步时发生错误', error);
      return this.finishWithDamaiResponse(recordId, buildDamaiCreateOrderError('10099', '系统异常'));
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
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('10001', '签名错误'));
    }

    const daMaiOrderId = payload.bodyPayOrder?.orderInfo?.daMaiOrderId;
    if (!daMaiOrderId) {
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('10001', '参数异常'));
    }

    const firstSuccessRecord = await getFirstSuccessfulDamaiOrderSyncRecordByDamaiOrderId(
      this.pool,
      schema,
      daMaiOrderId,
    );

    if (firstSuccessRecord?.order_id == null || firstSuccessRecord.user_id == null) {
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('30001', '订单不存在'));
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
        return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('30001', '订单不存在'));
      }

      if (code === 'ORDER_STATUS_INVALID') {
        return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('30007', '订单状态异常'));
      }

      this.logger.error('处理大麦订单支付回调时发生错误', error);
      return this.finishWithDamaiResponse(recordId, buildDamaiPayOrderError('10099', '系统异常'));
    }
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
