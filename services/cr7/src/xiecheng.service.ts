import { randomUUID } from 'node:crypto';
import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import config from 'config';
import { Context, Errors } from 'moleculer';
import MoleculerWeb from 'moleculer-web';
import type { Exhibition, Xiecheng } from '@cr7/types';
import {
  createXcSyncLog,
  listXcSyncLogs,
  XiechengDataError,
  createXcOrderSyncRecord,
  getXcOrderSyncRecordById,
  getFirstSuccessfulXcOrderSyncRecordByOtaOrderId,
  listXcOrderSyncRecordsByOtaOrderId,
  XcOrderDataError,
} from './data/xiecheng.js';
import { handleXiechengError } from './libs/errors.js';
import { RC7BaseService } from './libs/cr7.base.js';
import {
  xieChengSyncInventory,
  xieChengSyncPrice,
  XieChengBusinessError,
  decryptXieChengBody,
  buildXieChengSign,
  encryptXieChengBody,
} from './libs/xiecheng.js';

const { MoleculerClientError } = Errors;
const { NotFoundError } = MoleculerWeb.Errors;

interface UserMeta {
  uid: string;
}

type SyncDateRange = {
  start_session_date: Date;
  end_session_date: Date;
};

function parseDateLabel(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new MoleculerClientError('日期格式不合法，应为 yyyy-MM-dd', 400, 'INVALID_DATE_FORMAT');
    }
    return startOfDay(value);
  }

  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) {
    throw new MoleculerClientError('日期格式不合法，应为 yyyy-MM-dd', 400, 'INVALID_DATE_FORMAT');
  }

  return startOfDay(date);
}

function assertSyncDateRange(
  exhibition: Exhibition.Exhibition,
  startSessionDate: Date,
  endSessionDate: Date,
) {
  const startDate = startOfDay(startSessionDate);
  const endDate = startOfDay(endSessionDate);

  if (isAfter(startDate, endDate)) {
    throw new XiechengDataError('Invalid date range', 'INVALID_DATE_RANGE');
  }

  const exhibitionStartDate = parseDateLabel(exhibition.start_date);
  const exhibitionEndDate = parseDateLabel(exhibition.end_date);

  if (isBefore(startDate, exhibitionStartDate) || isAfter(endDate, exhibitionEndDate)) {
    throw new XiechengDataError('Session date is out of exhibition range', 'SESSION_DATE_OUT_OF_RANGE');
  }

  const maxEndDate = startOfDay(addDays(new Date(), 210));
  if (isAfter(endDate, maxEndDate)) {
    throw new XiechengDataError('Session end date is too far', 'SESSION_END_TOO_FAR');
  }
}

function toYuan(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default class XiechengService extends RC7BaseService {
  constructor(broker) {
    super(broker);

    this.parseServiceSchema({
      name: 'xiecheng',
      settings: {
        $noVersionPrefix: true,
      },

      hooks: {
        before: {
          '*': ['checkUserRole'],
        },
      },

      actions: {
        bindXiechengOptionId: {
          rest: 'PUT /:eid/tickets/:tid/ota/xc',
          roles: ['admin'],
          params: {
            eid: 'string',
            tid: 'string',
            ota_option_id: 'string|min:1',
          },
          handler: this.bindXiechengOptionId,
        },

        syncXiechengPrice: {
          rest: 'POST /:eid/tickets/:tid/ota/xc/sync',
          roles: ['admin'],
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
          handler: this.syncXiechengPrice,
        },

        syncXiechengInventory: {
          rest: 'POST /:eid/tickets/:tid/ota/xc/sync/inventory',
          roles: ['admin'],
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
            quantity: {
              type: 'number',
              integer: true,
              positive: true,
              optional: true,
            },
          },
          handler: this.syncXiechengInventory,
        },

        listXiechengSyncLogs: {
          rest: 'GET /:eid/tickets/:tid/ota/xc/sync/logs',
          roles: ['admin'],
          params: {
            eid: 'string',
            tid: 'string',
            service_name: {
              type: 'enum',
              values: ['DatePriceModify', 'DateInventoryModify'],
              optional: true,
            },
          },
          handler: this.listXiechengSyncLogs,
        },

        receiveCtripCallback: {
          rest: 'POST /callback',
          roles: [],
          params: {
            header: 'object',
            body: {
              type: 'string',
              optional: true,
            },
          },
          handler: this.receiveCtripCallback,
        },

        getCtripOrderRecord: {
          rest: 'GET /orders/:rid',
          roles: ['admin'],
          params: {
            rid: 'string',
          },
          handler: this.getCtripOrderRecord,
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

  async bindXiechengOptionId(
    ctx: Context<{ eid: string; tid: string; ota_option_id: string }, UserMeta>,
  ) {
    const { eid, tid, ota_option_id } = ctx.params;
    return ctx.call('cr7.exhibition.updateTicketXcOptionId', { eid, tid, ota_option_id });
  }

  async syncXiechengPrice(
    ctx: Context<{ eid: string; tid: string } & SyncDateRange, UserMeta>,
  ): Promise<Xiecheng.XcSyncLog> {
    const {
      eid,
      tid,
      start_session_date: startSessionDate,
      end_session_date: endSessionDate,
    } = ctx.params;

    const exhibition = await ctx.call('cr7.exhibition.get', { eid }) as Exhibition.Exhibition;
    try {
      assertSyncDateRange(exhibition, startSessionDate, endSessionDate);
    } catch (error) {
      handleXiechengError(error);
    }

    const ticket = await ctx.call('cr7.exhibition.getTicket', { eid, tid }) as Exhibition.TicketCategory;
    if (!ticket.ota_xc_option_id) {
      handleXiechengError(new XiechengDataError('Ticket category has no xiecheng option id', 'TICKET_CATEGORY_NOT_BOUND'));
    }

    const sessions = await ctx.call('cr7.exhibition.getSessions', {
      eid,
      start_session_date: startSessionDate,
      end_session_date: endSessionDate,
    }) as Exhibition.Session[];

    const dates = sessions.map(session => format(new Date(session.session_date), 'yyyy-MM-dd'));

    const syncItems: Xiecheng.XcPriceSyncItem[] = dates.map(date => ({
      date,
      sale_price: toYuan(ticket.price),
      cost_price: toYuan(ticket.price),
    }));

    const sequenceId = randomUUID();
    const requestBody = {
      sequenceId,
      otaOptionId: ticket.ota_xc_option_id,
      supplierOptionId: ticket.id,
      dateType: 'DATE_REQUIRED',
      prices: syncItems.map(item => ({
        date: item.date,
        salePrice: item.sale_price,
        costPrice: item.cost_price,
      })),
    };

    let syncResponse: unknown;
    let status: Xiecheng.XcSyncStatus = 'SUCCESS';
    try {
      syncResponse = await xieChengSyncPrice(
        `${config.xiecheng.base_url}/api/product/price.do`,
        {
          accountId: config.xiecheng.account_id,
          signKey: config.xiecheng.secret,
          aesKey: config.xiecheng.aes_key,
          aesIv: config.xiecheng.aes_iv,
          body: requestBody,
        },
      );
    } catch (error) {
      status = 'FAILURE';
      if (error instanceof XieChengBusinessError) {
        syncResponse = {
          result_code: error.resultCode,
          result_message: error.resultMessage,
          raw: error.response,
        };
      } else {
        syncResponse = {
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const log = await this.createXiechengSyncLog({
      sequence_id: sequenceId,
      ticket_category_id: ticket.id,
      service_name: 'DatePriceModify',
      ota_option_id: ticket.ota_xc_option_id,
      sync_items: syncItems,
      sync_response: syncResponse,
      status,
    });

    if (status === 'FAILURE') {
      throw new MoleculerClientError('携程价格同步失败', 502, 'XIECHENG_SYNC_FAILED');
    }

    return log;
  }

  async syncXiechengInventory(
    ctx: Context<{ eid: string; tid: string; quantity?: number } & SyncDateRange, UserMeta>,
  ): Promise<Xiecheng.XcSyncLog> {
    const {
      eid,
      tid,
      quantity,
      start_session_date: startSessionDate,
      end_session_date: endSessionDate,
    } = ctx.params;

    const exhibition = await ctx.call('cr7.exhibition.get', { eid }) as Exhibition.Exhibition;
    try {
      assertSyncDateRange(exhibition, startSessionDate, endSessionDate);
    } catch (error) {
      handleXiechengError(error);
    }

    const ticket = await ctx.call('cr7.exhibition.getTicket', { eid, tid }) as Exhibition.TicketCategory;
    if (!ticket.ota_xc_option_id) {
      handleXiechengError(new XiechengDataError('Ticket category has no xiecheng option id', 'TICKET_CATEGORY_NOT_BOUND'));
    }

    const sessionInventory = await ctx.call(
      'cr7.exhibition.listSessionInventoryByTicketAndDateRange',
      { eid, tid, start_session_date: startSessionDate, end_session_date: endSessionDate },
    ) as Array<{ date: string; quantity: number }>;

    const syncItems: Xiecheng.XcInventorySyncItem[] = sessionInventory.map(item => ({
      date: item.date,
      quantity: typeof quantity === 'number' ? quantity : item.quantity,
    }));

    if (typeof quantity === 'number' && sessionInventory.some(item => quantity > item.quantity)) {
      handleXiechengError(new XiechengDataError(
        'Sync quantity exceeds remaining inventory',
        'SYNC_QUANTITY_EXCEEDS_REMAINING',
      ));
    }

    const sequenceId = randomUUID();
    const requestBody = {
      sequenceId,
      otaOptionId: ticket.ota_xc_option_id,
      supplierOptionId: ticket.id,
      dateType: 'DATE_REQUIRED',
      inventories: syncItems.map(item => ({
        date: item.date,
        quantity: item.quantity,
      })),
    };

    let syncResponse: unknown;
    let status: Xiecheng.XcSyncStatus = 'SUCCESS';
    try {
      syncResponse = await xieChengSyncInventory(
        `${config.xiecheng.base_url}/api/product/stock.do`,
        {
          accountId: config.xiecheng.account_id,
          signKey: config.xiecheng.secret,
          aesKey: config.xiecheng.aes_key,
          aesIv: config.xiecheng.aes_iv,
          body: requestBody,
        },
      );
    } catch (error) {
      status = 'FAILURE';
      if (error instanceof XieChengBusinessError) {
        syncResponse = {
          result_code: error.resultCode,
          result_message: error.resultMessage,
          raw: error.response,
        };
      } else {
        syncResponse = {
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const log = await this.createXiechengSyncLog({
      sequence_id: sequenceId,
      ticket_category_id: ticket.id,
      service_name: 'DateInventoryModify',
      ota_option_id: ticket.ota_xc_option_id,
      sync_items: syncItems,
      sync_response: syncResponse,
      status,
    });

    if (status === 'FAILURE') {
      throw new MoleculerClientError('携程库存同步失败', 502, 'XIECHENG_SYNC_FAILED');
    }

    return log;
  }

  async listXiechengSyncLogs(
    ctx: Context<{ eid: string; tid: string; service_name?: Xiecheng.XcServiceName }, UserMeta>,
  ) {
    const { eid, tid, service_name: serviceName } = ctx.params;
    await ctx.call('cr7.exhibition.getTicket', { eid, tid });
    const logs = await this.listXiechengSyncLogsData({
      tid,
      service_name: serviceName,
    });

    return logs.map(item => ({
      ...item,
      created_at: format(new Date(item.created_at), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    }));
  }

  async createXiechengSyncLog(params: {
    sequence_id?: string;
    ticket_category_id: string;
    service_name: 'DatePriceModify' | 'DateInventoryModify';
    ota_option_id: string;
    sync_items: Xiecheng.XcSyncItem[];
    sync_response?: unknown;
    status: 'SUCCESS' | 'FAILURE';
  }): Promise<Xiecheng.XcSyncLog> {
    const schema = await this.getSchema();

    return createXcSyncLog(this.pool, schema, {
      sequenceId: params.sequence_id,
      ticketCategoryId: params.ticket_category_id,
      serviceName: params.service_name,
      otaOptionId: params.ota_option_id,
      syncItems: params.sync_items,
      syncResponse: params.sync_response,
      status: params.status,
    }).catch(handleXiechengError);
  }

  async listXiechengSyncLogsData(params: {
    tid: string;
    service_name?: 'DatePriceModify' | 'DateInventoryModify';
  }): Promise<Xiecheng.XcSyncLog[]> {
    const schema = await this.getSchema();

    return listXcSyncLogs(this.pool, schema, {
      tid: params.tid,
      serviceName: params.service_name,
    }).catch(handleXiechengError);
  }

  buildXcErrorResponse(resultCode: string, resultMessage: string): Xiecheng.XcEncryptedOrderResponse {
    return {
      header: { resultCode, resultMessage },
    };
  }

  buildXcSuccessResponse(
    successBody: Xiecheng.XcCreatePreOrderSuccessBody,
  ): Xiecheng.XcEncryptedOrderResponse {
    const xcConfig = config.xiecheng;
    const plainBody = JSON.stringify(successBody);
    const encryptedBody = encryptXieChengBody(plainBody, xcConfig.aes_key, xcConfig.aes_iv);
    return {
      header: { resultCode: '0000', resultMessage: '操作成功' },
      body: encryptedBody,
    };
  }

  validateCtripNotificationHeader(
    header: Xiecheng.XcRequestHeader,
    encryptedBody: string | undefined,
  ): Xiecheng.XcEncryptedOrderResponse | null {
    const xcConfig = config.xiecheng;

    if (header.accountId !== xcConfig.account_id) {
      return this.buildXcErrorResponse('0003', '供应商账户信息不正确');
    }

    const encBodyForSign = encryptedBody ?? '';
    const { sign: expectedSign } = buildXieChengSign(encBodyForSign, {
      accountId: header.accountId,
      serviceName: header.serviceName,
      requestTime: header.requestTime,
      version: header.version,
      signKey: xcConfig.secret,
    });

    if (header.sign !== expectedSign) {
      return this.buildXcErrorResponse('0002', '签名错误');
    }

    return null;
  }

  decryptCtripOrderBody(
    encryptedBody: string | undefined,
  ): Xiecheng.XcCreatePreOrderBody | null {
    const xcConfig = config.xiecheng;

    try {
      if (!encryptedBody) {
        return null;
      }
      const plainBody = decryptXieChengBody(encryptedBody, xcConfig.aes_key, xcConfig.aes_iv);
      return JSON.parse(plainBody) as Xiecheng.XcCreatePreOrderBody;
    } catch {
      return null;
    }
  }

  async tryGetTicketCategoryByPlu(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    plu: string,
  ): Promise<Exhibition.TicketCategory | null> {
    try {
      return await ctx.call('cr7.exhibition.getTicketByIdGlobal', { tid: plu }) as Exhibition.TicketCategory;
    } catch {
      return null;
    }
  }

  async tryGetSessionByUseDate(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    exhibitId: string,
    useDate: string,
  ): Promise<Exhibition.Session | null> {
    try {
      const sessions = await ctx.call('cr7.exhibition.getSessions', { eid: exhibitId }) as Exhibition.Session[];
      return sessions.find(s => format(new Date(s.session_date), 'yyyy-MM-dd') === useDate) ?? null;
    } catch {
      return null;
    }
  }

  async tryFindOrCreateUserIdByPhone(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    phone: string | null,
    countryCode: string | null,
    fallbackName: string,
  ): Promise<string | null> {
    if (!phone || !countryCode) {
      return null;
    }

    try {
      return await ctx.call('user.findOrCreateByPhone', {
        country_code: countryCode,
        phone,
        name: fallbackName,
      }) as string;
    } catch {
      return null;
    }
  }

  sanitizeOrderSyncRecord(
    record: Xiecheng.XcOrderSyncRecord & { response_body?: unknown },
  ): Xiecheng.XcOrderSyncRecord {
    const { response_body: _ignored, ...sanitized } = record;
    return sanitized;
  }

  async persistRecord(params: {
    schema: string;
    otaOrderId: string;
    sequenceId: string;
    header: Xiecheng.XcRequestHeader;
    orderBody: Xiecheng.XcCreatePreOrderBody;
    phone: string | null;
    countryCode: string | null;
    recordParams: {
      id?: string;
      responseBody: Xiecheng.XcEncryptedOrderResponse;
      totalAmount: number | null;
      syncStatus: Xiecheng.XcOrderSyncStatus;
      userId: string | null;
      orderId: string | null;
    };
  }): Promise<Xiecheng.XcOrderSyncRecord> {
    return createXcOrderSyncRecord(this.pool, params.schema, {
      id: params.recordParams.id,
      serviceName: 'CreatePreOrder',
      otaOrderId: params.otaOrderId,
      sequenceId: params.sequenceId,
      requestHeader: params.header,
      requestBody: params.orderBody,
      responseBody: params.recordParams.responseBody,
      phone: params.phone,
      countryCode: params.countryCode,
      totalAmount: params.recordParams.totalAmount,
      syncStatus: params.recordParams.syncStatus,
      userId: params.recordParams.userId,
      orderId: params.recordParams.orderId,
    });
  }

  async failAndPersist(params: {
    schema: string;
    otaOrderId: string;
    sequenceId: string;
    header: Xiecheng.XcRequestHeader;
    orderBody: Xiecheng.XcCreatePreOrderBody;
    phone: string | null;
    countryCode: string | null;
    resultCode: string;
    resultMessage: string;
    extra?: { userId?: string | null; orderId?: string | null; totalAmount?: number | null };
  }): Promise<Xiecheng.XcEncryptedOrderResponse> {
    const responseBody = this.buildXcErrorResponse(params.resultCode, params.resultMessage);
    await this.persistRecord({
      schema: params.schema,
      otaOrderId: params.otaOrderId,
      sequenceId: params.sequenceId,
      header: params.header,
      orderBody: params.orderBody,
      phone: params.phone,
      countryCode: params.countryCode,
      recordParams: {
        responseBody,
        totalAmount: params.extra?.totalAmount ?? null,
        syncStatus: 'FAILED',
        userId: params.extra?.userId ?? null,
        orderId: params.extra?.orderId ?? null,
      },
    });
    return responseBody;
  }

  async receiveCtripCallback(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
  ): Promise<Xiecheng.XcEncryptedOrderResponse> {
    ctx.meta.$statusCode = 200;
    const { header, body: encryptedBody } = ctx.params;

    const headerError = this.validateCtripNotificationHeader(header, encryptedBody);
    if (headerError) {
      return headerError;
    }

    const orderBody = this.decryptCtripOrderBody(encryptedBody);
    if (!orderBody) {
      return this.buildXcErrorResponse('0001', '报文解析失败');
    }

    const { otaOrderId, sequenceId, contacts, items } = orderBody;
    const schema = await this.getSchema();
    const firstSuccessRecord = await getFirstSuccessfulXcOrderSyncRecordByOtaOrderId(
      this.pool, schema, otaOrderId,
    );

    const contact = contacts?.[0] ?? {};
    const phone = contact.mobile ?? null;
    const countryCode = contact.intlCode ?? null;

    if (firstSuccessRecord) {
      const responseBody = this.buildXcSuccessResponse({
        otaOrderId,
        supplierOrderId: firstSuccessRecord.order_id!,
        items: items.map(item => ({ itemId: item.plu, quantity: item.quantity })),
      });

      await this.persistRecord({
        schema,
        otaOrderId,
        sequenceId,
        header,
        orderBody,
        phone,
        countryCode,
        recordParams: {
          responseBody,
          totalAmount: firstSuccessRecord.total_amount,
          syncStatus: 'DUPLICATE_ORDER',
          userId: firstSuccessRecord.user_id,
          orderId: firstSuccessRecord.order_id,
        },
      });

      return responseBody;
    }

    if (!items || items.length === 0) {
      return this.failAndPersist({
        schema,
        otaOrderId,
        sequenceId,
        header,
        orderBody,
        phone,
        countryCode,
        resultCode: '1001',
        resultMessage: '产品 PLU 不存在',
      });
    }

    const item = items[0];
    const ticketCategory = await this.tryGetTicketCategoryByPlu(ctx, item.plu);
    if (!ticketCategory) {
      return this.failAndPersist({
        schema,
        otaOrderId,
        sequenceId,
        header,
        orderBody,
        phone,
        countryCode,
        resultCode: '1001',
        resultMessage: '产品 PLU 不存在',
      });
    }

    const exhibitId = ticketCategory.exhibit_id;
    const matchSession = await this.tryGetSessionByUseDate(ctx, exhibitId, item.useDate);
    if (!matchSession) {
      return this.failAndPersist({
        schema,
        otaOrderId,
        sequenceId,
        header,
        orderBody,
        phone,
        countryCode,
        resultCode: '1009',
        resultMessage: '日期错误',
      });
    }

    const userId = await this.tryFindOrCreateUserIdByPhone(
      ctx,
      phone,
      countryCode,
      contact.name ?? (phone ? `ctrip_${phone}` : 'ctrip_user'),
    );

    const candidateOrderId = randomUUID();
    let createdOrderId: string | null = null;
    let totalAmount: number | null = null;

    const orderItems = items.map(i => ({
      ticket_category_id: i.plu,
      quantity: i.quantity,
    }));

    try {
      const order = await ctx.call('cr7.order.create', {
        id: candidateOrderId,
        eid: exhibitId,
        sid: matchSession.id,
        items: orderItems,
        source: 'CTRIP',
        ...(userId ? { user_id: userId } : {}),
      }) as { id: string; total_amount: number };

      createdOrderId = order.id;
      totalAmount = order.total_amount;
      const responseBody = this.buildXcSuccessResponse({
        otaOrderId,
        supplierOrderId: createdOrderId,
        items: items.map(i => ({ itemId: i.plu, quantity: i.quantity })),
      });

      // The first successful sync record uses id = order_id for quick identity checks.
      await this.persistRecord({
        schema,
        otaOrderId,
        sequenceId,
        header,
        orderBody,
        phone,
        countryCode,
        recordParams: {
          id: createdOrderId,
          responseBody,
          totalAmount,
          syncStatus: 'SUCCESS',
          userId,
          orderId: createdOrderId,
        },
      });

      return responseBody;
    } catch (error) {
      const errCode = (error as { code?: string })?.code;
      if (errCode === 'INVENTORY_NOT_ENOUGH') {
        return this.failAndPersist({
          schema,
          otaOrderId,
          sequenceId,
          header,
          orderBody,
          phone,
          countryCode,
          resultCode: '1003',
          resultMessage: '库存不足',
          extra: { userId, orderId: createdOrderId, totalAmount },
        });
      }
      if (errCode === 'SESSION_EXPIRED' || errCode === 'SESSION_NOT_FOUND') {
        return this.failAndPersist({
          schema,
          otaOrderId,
          sequenceId,
          header,
          orderBody,
          phone,
          countryCode,
          resultCode: '1009',
          resultMessage: '日期错误',
          extra: { userId, orderId: createdOrderId, totalAmount },
        });
      }
      if (errCode === 'TICKET_CATEGORY_NOT_FOUND') {
        return this.failAndPersist({
          schema,
          otaOrderId,
          sequenceId,
          header,
          orderBody,
          phone,
          countryCode,
          resultCode: '1001',
          resultMessage: '产品 PLU 不存在',
          extra: { userId, orderId: createdOrderId, totalAmount },
        });
      }

      return this.failAndPersist({
        schema,
        otaOrderId,
        sequenceId,
        header,
        orderBody,
        phone,
        countryCode,
        resultCode: '1100',
        resultMessage: `创建订单失败: ${(error as Error).message}`,
        extra: { userId, orderId: createdOrderId, totalAmount },
      });
    }
  }

  async getCtripOrderRecord(
    ctx: Context<{ rid: string }, UserMeta>,
  ): Promise<Xiecheng.XcOrderSyncRecord[]> {
    const { rid } = ctx.params;
    const schema = await this.getSchema();

    const listAndSanitizeByOtaOrderId = async (otaOrderId: string) => {
      const records = await listXcOrderSyncRecordsByOtaOrderId(this.pool, schema, otaOrderId);
      return records.map(record => this.sanitizeOrderSyncRecord(
        record as Xiecheng.XcOrderSyncRecord & { response_body?: unknown },
      ));
    };

    try {
      if (isUuidLike(rid)) {
        const record = await getXcOrderSyncRecordById(this.pool, schema, rid);
        if (record.ota_order_id) {
          return await listAndSanitizeByOtaOrderId(record.ota_order_id);
        }
        return [this.sanitizeOrderSyncRecord(record as Xiecheng.XcOrderSyncRecord & { response_body?: unknown })];
      }
    } catch (error) {
      if (error instanceof XcOrderDataError && error.code === 'XC_ORDER_SYNC_RECORD_NOT_FOUND') {
        try {
          return await listAndSanitizeByOtaOrderId(rid);
        } catch (lookupError) {
          if (lookupError instanceof XcOrderDataError && lookupError.code === 'XC_ORDER_SYNC_RECORD_NOT_FOUND') {
            throw new NotFoundError('携程订单同步记录不存在', 'XC_ORDER_SYNC_RECORD_NOT_FOUND');
          }
          throw lookupError;
        }
      }
      throw error;
    }

    try {
      return await listAndSanitizeByOtaOrderId(rid);
    } catch (error) {
      if (error instanceof XcOrderDataError && error.code === 'XC_ORDER_SYNC_RECORD_NOT_FOUND') {
        throw new NotFoundError('携程订单同步记录不存在', 'XC_ORDER_SYNC_RECORD_NOT_FOUND');
      }
      throw error;
    }
  }
}
