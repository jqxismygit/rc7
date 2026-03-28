import { randomUUID } from 'node:crypto';
import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import config from 'config';
import { Context, Errors } from 'moleculer';
import type { Exhibition, Xiecheng } from '@cr7/types';
import { createXcSyncLog, listXcSyncLogs, XiechengDataError } from './data/xiecheng.js';
import { handleXiechengError } from './libs/errors.js';
import { RC7BaseService } from './libs/cr7.base.js';
import { xieChengSyncInventory, xieChengSyncPrice, XieChengBusinessError } from './libs/xiecheng.js';

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
}
