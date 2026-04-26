import { Context, Errors, ServiceBroker, ServiceSchema } from 'moleculer';
import type { Exhibition, Invoice, Order } from '@cr7/types';
import { RC7BaseService } from './cr7.base.js';
import { sendFapiaoKpjRequest, FapiaoTraceableError } from './fapiao.js';
import {
  createInvoiceApplication,
  getInvoiceApplicationByOrder,
  listInvoiceApplicationsByUser,
  markInvoiceApplicationFailed,
  markInvoiceApplicationSuccess,
} from '../data/invoice.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
}

interface ApplyFapiaoRequest {
  oid: string;
  invoice_title: string;
  tax_no?: string;
  email: string;
}

interface ListFapiaoApplicationsRequest {
  oid?: string;
}

interface GetFapiaoApplicationAdminRequest {
  oid: string;
}

function getPdfUrlFromResponse(response: Record<string, unknown>) {
  const data = response.DATA;
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const pdfUrl = (data as Record<string, unknown>).PDF_URL;
  return typeof pdfUrl === 'string' ? pdfUrl : null;
}


export class FapiaoService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);
  }

  actions_fapiao: ServiceSchema['actions'] = {
    'invoice.applyFapiao': {
      rest: 'POST /:oid/invoice',
      params: {
        oid: 'string',
        invoice_title: 'string',
        tax_no: {
          type: 'string',
          optional: true,
        },
        email: 'string',
      },
      handler: this.applyFapiao,
    },
    'invoice.listFapiaoApplications': {
      rest: 'GET /invoice',
      params: {
        oid: {
          type: 'string',
          optional: true,
        },
      },
      handler: this.listFapiaoApplications,
    },
    'invoice.getFapiaoApplication': {
      rest: 'GET /:oid/invoice',
      params: {
        oid: 'string',
      },
      handler: this.getFapiaoApplication,
    },
  };

  async applyFapiao(
    ctx: Context<ApplyFapiaoRequest, { user: UserMeta; roles?: string[] }>,
  ) {
    const { oid, invoice_title, tax_no = '', email } = ctx.params;
    const { uid } = ctx.meta.user;
    const roleSet = new Set((ctx.meta.roles ?? []).map(role => role.toLowerCase()));
    const asAdmin = roleSet.has('admin');
    const client = this.pool;
    const schema = await this.getSchema();

    const order = await ctx.call(
      asAdmin ? 'cr7.order.getAdmin' : 'cr7.order.get',
      { oid },
      asAdmin
        ? { meta: { user: { uid }, roles: ['admin'] } }
        : { meta: { user: { uid } } },
    ) as Order.OrderWithItems;

    if (order.status === 'REFUNDED') {
      throw new MoleculerClientError('订单已退款，无法申请发票', 409, 'ORDER_REFUNDED');
    }

    if (order.status !== 'PAID') {
      throw new MoleculerClientError('订单未支付，无法申请发票', 409, 'ORDER_STATUS_INVALID');
    }

    if (order.items.length === 0) {
      throw new MoleculerClientError('Invalid order items', 400, 'INVALID_ARGUMENT');
    }

    const ticketCategories = await ctx.call(
      'cr7.exhibition.getTicketCategories',
      { eid: order.exhibit_id },
    ) as Exhibition.TicketCategory[];

    const nameByTicketCategoryId = new Map(
      ticketCategories.map(category => [category.id, category.name]),
    );

    let application = await getInvoiceApplicationByOrder(client, schema, oid);

    if (application?.status === 'SUCCESS') {
      throw new MoleculerClientError('该订单的发票已经开具成功', 409, 'ORDER_INVOICE_ALREADY_SUCCESS');
    }

    if (application === null) {
    // Persist first to lock in one sequence_id for the order before calling external fapiao service.
      application = await createInvoiceApplication(client, schema, {
        order_id: oid,
        user_id: order.user_id,
        invoice_title,
        tax_no,
        email,
        request: {},
        response: {},
      });
    }

    try {
      const { result, request, response } = await sendFapiaoKpjRequest({
        oid,
        invoice_title,
        tax_no,
        email,
        sequence_id: application.sequence_id,
        total_amount: order.total_amount,
        items: order.items.map(item => ({
          ticket_name: nameByTicketCategoryId.get(item.ticket_category_id) ?? item.ticket_category_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
      });

      const resultData = result.DATA;

      const persisted = await markInvoiceApplicationSuccess(client, schema, application.id, {
        request: request as unknown as Record<string, unknown>,
        response: response as Record<string, unknown>,
        invoice_no: resultData.FP_HM,
      });

      return persisted;
    } catch (error) {
      const fapiaoError = error as Error & FapiaoTraceableError;
      await markInvoiceApplicationFailed(client, schema, application.id, {
        request: typeof fapiaoError.fapiaoRequest === 'object' && fapiaoError.fapiaoRequest !== null
          ? fapiaoError.fapiaoRequest as unknown as Record<string, unknown>
          : {},
        response: typeof fapiaoError.fapiaoResponse === 'object' && fapiaoError.fapiaoResponse !== null
          ? fapiaoError.fapiaoResponse as Record<string, unknown>
          : {
              CODE: 'FAILED',
              MESSAGE: error instanceof Error ? error.message : '发票申请失败',
            },
      });
      throw error;
    }
  }

  async getFapiaoApplication(
    ctx: Context<GetFapiaoApplicationAdminRequest, { user: UserMeta; roles?: string[] }>,
  ) {
    const { oid } = ctx.params;
    const { uid } = ctx.meta.user;
    const isAdmin = (ctx.meta.roles ?? []).some(role => role.toLowerCase() === 'admin');

    await ctx.call(
      isAdmin ? 'cr7.order.getAdmin' : 'cr7.order.get',
      { oid },
      isAdmin
        ? { meta: { user: { uid }, roles: ['admin'] } }
        : { meta: { user: { uid } } },
    );

    const schema = await this.getSchema();
    const record = await getInvoiceApplicationByOrder(this.pool, schema, oid);
    if (record === null) {
      throw new MoleculerClientError('订单发票记录不存在', 404, 'ORDER_INVOICE_NOT_FOUND');
    }

    return {
      id: record.id,
      order_id: record.order_id,
      invoice_title: record.invoice_title,
      tax_no: record.tax_no,
      email: record.email,
      status: record.status,
      sequence_id: record.sequence_id,
      invoice_no: record.invoice_no,
      pdf_url: getPdfUrlFromResponse(record.response),
      created_at: record.created_at,
      updated_at: record.updated_at,
    } as Invoice.InvoiceRecord;
  }

  async listFapiaoApplications(
    ctx: Context<ListFapiaoApplicationsRequest, { user: UserMeta }>,
  ) {
    const { uid } = ctx.meta.user;
    const { oid } = ctx.params;
    const schema = await this.getSchema();
    const records = await listInvoiceApplicationsByUser(this.pool, schema, uid);

    const filtered = oid
      ? records.filter(record => record.order_id === oid)
      : records;

    return {
      items: filtered.map(record => ({
        id: record.id,
        order_id: record.order_id,
        invoice_title: record.invoice_title,
        tax_no: record.tax_no,
        email: record.email,
        status: record.status,
        sequence_id: record.sequence_id,
        invoice_no: record.invoice_no,
        pdf_url: getPdfUrlFromResponse(record.response),
        created_at: record.created_at,
        updated_at: record.updated_at,
      })),
    } as Invoice.InvoiceListResult;
  }
}
