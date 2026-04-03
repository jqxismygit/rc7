import { randomUUID } from 'node:crypto';
import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import config from 'config';
import { Context, Errors, ServiceBroker } from 'moleculer';
import type { Exhibition, Order, Xiecheng } from '@cr7/types';
import {
  createXcSyncLog,
  listXcSyncLogs,
  XiechengDataError,
  createXcOrderSyncRecord,
  getFirstSuccessfulXcOrderSyncRecordByOtaOrderId,
  listXcOrderSyncRecords,
  listXcOrderSyncRecordsByOrderId,
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
import { XcRequestHeader } from '@cr7/types/xiecheng.js';

const { MoleculerClientError } = Errors;

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

function toXcOrderStatus(status: Order.OrderStatus): number {
  switch (status) {
    case 'PAID': return 2;
    case 'CANCELLED': return 14;
    case 'EXPIRED':
    case 'REFUNDED': return 3;
    default: return 11;
  }
}

export default class XiechengService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
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
            rid: 'uuid',
          },
          handler: this.getCtripOrderRecord,
        },

        listCtripOrderRecords: {
          rest: 'GET /orders',
          roles: ['admin'],
          params: {
            limit: { type: 'number', optional: true, default: 10, min: 1, max: 100, convert: true },
            offset: { type: 'number', optional: true, default: 0, min: 0, convert: true },
            ota_order_id: { type: 'string', optional: true, min: 1 },
          },
          handler: this.listCtripOrderRecords,
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

  buildXcErrorResponse(
    resultCode: string,
    resultMessage: string
  ): Xiecheng.XcEncryptedOrderResponse {
    return {
      header: { resultCode, resultMessage },
    };
  }

  buildXcSuccessResponse(
    successBody:
      | Xiecheng.XcCreatePreOrderSuccessBody
      | Xiecheng.XcQueryOrderSuccessBody
      | Xiecheng.XcCancelPreOrderSuccessBody
      | Xiecheng.XcPayPreOrderSuccessBody,
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


  async persistRecord(params: {
    schema: string;
    serviceName: Xiecheng.XcOrderServiceName;
    otaOrderId: string;
    sequenceId: string;
    header: Xiecheng.XcRequestHeader;
    orderBody:
      | Xiecheng.XcCreatePreOrderBody
      | Xiecheng.XcQueryOrderBody
      | Xiecheng.XcCancelPreOrderBody
      | Xiecheng.XcPayPreOrderBody;
    phone: string | null;
    countryCode: string | null;
    recordParams: {
      id?: string;
      responseBody: unknown;
      totalAmount: number | null;
      syncStatus: Xiecheng.XcOrderSyncStatus;
      userId: string | null;
      orderId: string | null;
    };
  }): Promise<Xiecheng.XcOrderSyncRecord> {
    return createXcOrderSyncRecord(this.pool, params.schema, {
      id: params.recordParams.id,
      serviceName: params.serviceName,
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

  async failAndPersist(
    header: XcRequestHeader,
    orderBody:
      | Xiecheng.XcCreatePreOrderBody
      | Xiecheng.XcQueryOrderBody
      | Xiecheng.XcCancelPreOrderBody
      | Xiecheng.XcPayPreOrderBody,
    resultCode: string,
    resultMessage: string,
    record?: {
      phone?: string | null;
      country_code?: string | null;
      user_id?: string | null;
      order_id?: string | null;
      total_amount?: number | null;
    } | null
  ): Promise<Xiecheng.XcEncryptedOrderResponse> {
    const schema = await this.getSchema();
    const { otaOrderId, sequenceId } = orderBody;
    const responseBody = this.buildXcErrorResponse(resultCode, resultMessage);

    await this.persistRecord({
      schema,
      serviceName: header.serviceName,
      otaOrderId,
      sequenceId,
      header,
      orderBody,
      phone: record?.phone ?? null,
      countryCode: record?.country_code ?? null,
      recordParams: {
        responseBody,
        totalAmount: record?.total_amount ?? null,
        syncStatus: 'FAILED',
        userId: record?.user_id ?? null,
        orderId: record?.order_id ?? null,
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

    const xcConfig = config.xiecheng;
    let decryptBody: unknown = null;
    try {
      const plain = decryptXieChengBody(encryptedBody, xcConfig.aes_key, xcConfig.aes_iv);
      decryptBody = JSON.parse(plain)
    } catch {
      return this.buildXcErrorResponse('0001', '报文解析失败');
    }

    const schema = await this.getSchema();

    if (header.serviceName === 'QueryOrder') {
      return this.handleQueryOrder(ctx, schema, decryptBody as Xiecheng.XcQueryOrderBody);
    }

    if (header.serviceName === 'CancelPreOrder') {
      return this.handleCancelOrder(
        ctx,
        schema,
        header,
        decryptBody as Xiecheng.XcCancelPreOrderBody,
      );
    }

    if (header.serviceName === 'PayPreOrder') {
      return this.handlePayOrder(
        ctx,
        schema,
        header,
        decryptBody as Xiecheng.XcPayPreOrderBody,
      );
    }

    if (header.serviceName === 'CreatePreOrder') {
      return this.handleCreateOrder(ctx, schema, header, decryptBody as Xiecheng.XcCreatePreOrderBody);
    }

    this.logger.warn(`Unsupported service name in xiecheng callback: ${header.serviceName}`);
    throw new MoleculerClientError('不支持的服务名称', 400, 'UNSUPPORTED_SERVICE_NAME');
  }

  async handleQueryOrder(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    schema: string,
    decryptBody: Xiecheng.XcQueryOrderBody,
  ): Promise<Xiecheng.XcEncryptedOrderResponse> {

    const { otaOrderId } = decryptBody!;
    const record = await getFirstSuccessfulXcOrderSyncRecordByOtaOrderId(this.pool, schema, otaOrderId);
    if (!record || !record.order_id) {
      return this.buildXcErrorResponse('1001', '订单不存在');
    }

    const order = await ctx.call(
      'cr7.order.get',
      { oid: record.order_id },
      { meta: { user: { uid: record.user_id } } }
    ) as Order.OrderWithItems;
    const xcOrderStatus = toXcOrderStatus(order.status);
    const isCancelled = ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(order.status);
    const createOrderBody = record.request_body as Xiecheng.XcCreatePreOrderBody;

    const items: Xiecheng.XcQueryOrderResponseItem[] = createOrderBody.items
    .map((item: Xiecheng.XcCreatePreOrderItem, idx: number) => ({
      itemId: idx,
      useStartDate: item.useStartDate,
      useEndDate: item.useEndDate,
      orderStatus: xcOrderStatus,
      quantity: item.quantity,
      useQuantity: order.status === 'PAID' ? item.quantity : 0,
      cancelQuantity: isCancelled ? item.quantity : 0,
      passengers: [],
      vouchers: [],
    }));

    return this.buildXcSuccessResponse({
      otaOrderId,
      supplierOrderId: record.order_id,
      items,
    });
  }

  async handleCreateOrder(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    schema: string,
    header: Xiecheng.XcRequestHeader,
    orderBody: Xiecheng.XcCreatePreOrderBody,
  ): Promise<Xiecheng.XcEncryptedOrderResponse> {
    const { otaOrderId, sequenceId, contacts, items } = orderBody;
    const firstSuccessRecord = await getFirstSuccessfulXcOrderSyncRecordByOtaOrderId(
      this.pool, schema, otaOrderId,
    );

    const contact = contacts?.[0] ?? {};
    const phone = contact.mobile ?? null;
    const countryCode = contact.intlCode ?? null;

    if (firstSuccessRecord) {
      const responseBody = {
        otaOrderId,
        supplierOrderId: firstSuccessRecord.order_id!,
        items: items.map(item => ({
          PLU: item.PLU,
          inventorys: [{
            useDate: item.useStartDate,
            quantity: item.quantity,
          }],
        })),
      };

      await this.persistRecord({
        schema,
        serviceName: 'CreatePreOrder',
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

      return this.buildXcSuccessResponse(responseBody);
    }

    if (!items || items.length === 0) {
      return this.failAndPersist(header, orderBody, '1002', '订单中没有任何商品', firstSuccessRecord);
    }

    const item = items[0];
    const ticketCategory = await ctx.call<
      Exhibition.TicketCategory, { tid: string }
    >('cr7.exhibition.getTicketByIdGlobal', { tid: item.PLU })
    .catch(() => null);
    if (!ticketCategory) {
      return this.failAndPersist(header, orderBody, '1001', '产品 PLU 不存在', firstSuccessRecord);
    }

    const exhibitId = ticketCategory.exhibit_id;
    if (!item.useStartDate || !item.useEndDate || item.useStartDate !== item.useEndDate) {
      return this.failAndPersist(header, orderBody, '1009', '日期错误', firstSuccessRecord);
    }

    const sessions = await ctx.call<Exhibition.Session[], { eid: string }>(
      'cr7.exhibition.getSessions', { eid: exhibitId }
    );
    const matchSession = sessions
    .find(s => format(new Date(s.session_date), 'yyyy-MM-dd') === item.useStartDate) ?? null;
    if (!matchSession) {
      return this.failAndPersist(header, orderBody, '1009', '日期错误', firstSuccessRecord);
    }

    const userId = await ctx.call(
      'user.findOrCreateByPhone',
      {
        country_code: countryCode,
        phone,
        name: contact.name,
      }
    ) as string;

    const candidateOrderId = randomUUID();
    let createdOrderId: string | null = null;
    let totalAmount: number | null = null;

    const orderItems = items.map(i => ({
      ticket_category_id: i.PLU,
      quantity: i.quantity,
    }));

    try {
      const order = await ctx.call('cr7.order.create', {
        id: candidateOrderId,
        eid: exhibitId,
        sid: matchSession.id,
        items: orderItems,
        source: 'CTRIP',
        user_id: userId,
      }) as { id: string; total_amount: number };

      createdOrderId = order.id;
      totalAmount = order.total_amount;
      const responseBody = {
        otaOrderId,
        supplierOrderId: createdOrderId,
        items: items.map(i => ({
          PLU: i.PLU,
          inventorys: [{
            useDate: i.useStartDate,
            quantity: i.quantity,
          }],
        })),
      };

      // The first successful sync record uses id = order_id for quick identity checks.
      await this.persistRecord({
        schema,
        serviceName: 'CreatePreOrder',
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

      return this.buildXcSuccessResponse(responseBody);
    } catch (error) {
      const errCode = (error as { code?: string })?.code;
      const record = {
        user_id: userId, phone, country_code: countryCode,
        order_id: createdOrderId, total_amount: totalAmount
      };
      if (errCode === 'INVENTORY_NOT_ENOUGH') {
        return this.failAndPersist(header, orderBody, '1003', '库存不足', record);
      }
      if (errCode === 'SESSION_EXPIRED' || errCode === 'SESSION_NOT_FOUND') {
        return this.failAndPersist(header, orderBody, '1009', '日期错误', record);
      }
      if (errCode === 'TICKET_CATEGORY_NOT_FOUND') {
        return this.failAndPersist(header, orderBody, '1001', '产品 PLU 不存在', record);
      }

      return this.failAndPersist(header, orderBody, '1100', `创建订单失败: ${(error as Error).message}`, record);
    }
  }

  async handleCancelOrder(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    schema: string,
    header: Xiecheng.XcRequestHeader,
    cancelBody: Xiecheng.XcCancelPreOrderBody,
  ): Promise<Xiecheng.XcEncryptedOrderResponse> {
    const { otaOrderId, sequenceId } = cancelBody;
    const firstSuccessRecord = await getFirstSuccessfulXcOrderSyncRecordByOtaOrderId(
      this.pool,
      schema,
      otaOrderId,
    );

    if (!firstSuccessRecord || !firstSuccessRecord.order_id) {
      return this.buildXcErrorResponse('1001', '订单不存在');
    }

    try {
      await ctx.call(
        'cr7.order.cancel',
        { oid: firstSuccessRecord.order_id },
        { meta: { user: { uid: firstSuccessRecord.user_id } } },
      )
    } catch (error) {
      return this.failAndPersist(
        header, cancelBody,
        '1100', `取消订单失败: ${(error as Error).message}`,
        firstSuccessRecord
      );
    }
    ctx.meta.$statusCode = 200;

    const cancelledOrder = await ctx.call(
      'cr7.order.get',
      { oid: firstSuccessRecord.order_id },
      { meta: { user: { uid: firstSuccessRecord.user_id } } }
    ) as Order.OrderWithItems;
    const createOrderBody = firstSuccessRecord.request_body as Xiecheng.XcCreatePreOrderBody;
    const items = createOrderBody.items
    .map((_item: Xiecheng.XcCreatePreOrderItem, index: number) => ({
      itemId: index,
      orderStatus: toXcOrderStatus(cancelledOrder.status),
    }));
    const responseBody: Xiecheng.XcCancelPreOrderSuccessBody = {
      otaOrderId,
      supplierOrderId: firstSuccessRecord.order_id,
      items,
    };

    await this.persistRecord({
      schema,
      serviceName: 'CancelPreOrder',
      otaOrderId,
      sequenceId,
      header,
      orderBody: cancelBody,
      phone: firstSuccessRecord.phone,
      countryCode: firstSuccessRecord.country_code,
      recordParams: {
        responseBody,
        totalAmount: firstSuccessRecord.total_amount,
        syncStatus: 'SUCCESS',
        userId: firstSuccessRecord.user_id,
        orderId: firstSuccessRecord.order_id,
      },
    });

    return this.buildXcSuccessResponse(responseBody);
  }

  async handlePayOrder(
    ctx: Context<Xiecheng.XcEncryptedOrderNotification, Record<string, unknown>>,
    schema: string,
    header: Xiecheng.XcRequestHeader,
    payBody: Xiecheng.XcPayPreOrderBody,
  ): Promise<Xiecheng.XcEncryptedOrderResponse> {
    const { otaOrderId, sequenceId, supplierOrderId } = payBody;
    const firstSuccessRecord = await getFirstSuccessfulXcOrderSyncRecordByOtaOrderId(
      this.pool,
      schema,
      otaOrderId,
    );

    if (!firstSuccessRecord || !firstSuccessRecord.order_id) {
      return this.failAndPersist(header, payBody, '1001', '订单不存在');
    }

    if (firstSuccessRecord.order_id !== supplierOrderId) {
      return this.failAndPersist(header, payBody, '1001', '订单不存在', firstSuccessRecord);
    }

    try {
      await ctx.call('cr7.order.markPaid', { oid: supplierOrderId });
    } catch (error) {
      return this.failAndPersist(
        header, payBody,
        '1100', `支付订单失败: ${(error as Error).message}`, firstSuccessRecord
      );
    }

    let redemption: { order_id: string; code: string };
    try {
      redemption = await ctx.call(
        'cr7.redemption.getByOrder',
        { oid: supplierOrderId },
        { meta: { user: { uid: firstSuccessRecord.user_id } } },
      );
    } catch (error) {
      return this.failAndPersist(
        header, payBody,
        '1100', `获取订单核销码失败: ${(error as Error).message}`, firstSuccessRecord
      );
    }

    const responseBody: Xiecheng.XcPayPreOrderSuccessBody = {
      otaOrderId,
      supplierOrderId,
      supplierConfirmType: 1,
      voucherSender: 1,
      vouchers: payBody.items.map(item => ({
        itemId: item.itemId,
        voucherId: redemption.order_id,
        voucherType: 3,
        voucherCode: redemption.code,
        voucherData: redemption.code,
      })),
      items: payBody.items.map(item => ({
        itemId: item.itemId,
        isCredentialVouchers: 0,
        orderStatus: 13,
      })),
    };

    await this.persistRecord({
      schema,
      serviceName: 'PayPreOrder',
      otaOrderId,
      sequenceId,
      header,
      orderBody: payBody,
      phone: firstSuccessRecord.phone,
      countryCode: firstSuccessRecord.country_code,
      recordParams: {
        responseBody,
        totalAmount: firstSuccessRecord.total_amount,
        syncStatus: 'SUCCESS',
        userId: firstSuccessRecord.user_id,
        orderId: firstSuccessRecord.order_id,
      },
    });

    return this.buildXcSuccessResponse(responseBody);
  }

  async getCtripOrderRecord(
    ctx: Context<{ rid: string }, UserMeta>,
  ): Promise<Xiecheng.XcOrderSyncRecord[]> {
    const { rid } = ctx.params;
    const schema = await this.getSchema();

    return await listXcOrderSyncRecordsByOrderId(this.pool, schema, rid);
  }

  async listCtripOrderRecords(
    ctx: Context<{ limit?: number; offset?: number; ota_order_id?: string }, UserMeta>,
  ): Promise<{ data: Xiecheng.XcOrderSyncRecord[]; total: number; limit: number; offset: number }> {
    const {
      limit = 10,
      offset = 0,
      ota_order_id: otaOrderId,
    } = ctx.params;
    const schema = await this.getSchema();

    const { records, total } = await listXcOrderSyncRecords(this.pool, schema, {
      limit,
      offset,
      otaOrderId,
    });

    return {
      data: records,
      total,
      limit,
      offset,
    };
  }
}
