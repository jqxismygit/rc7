import { Server } from 'http';
import type { Invoice } from '@cr7/types';
import { getJSON, postJSON } from '../lib/api.js';

type ApplyInvoicePayload = Pick<Invoice.InvoiceRecord, 'invoice_title' | 'email'> & {
  tax_no?: Invoice.InvoiceRecord['tax_no'];
};


export async function applyOrderInvoice(
  server: Server,
  orderId: string,
  payload: ApplyInvoicePayload,
  token: string,
) {
  return postJSON<Invoice.InvoiceRecord>(
    server,
    `/orders/${orderId}/invoice`,
    { body: payload, token },
  );
}

export async function listInvoiceApplications(
  server: Server,
  token: string,
  query: { oid?: Invoice.InvoiceRecord['order_id'] } = {},
) {
  return getJSON<Invoice.InvoiceListResult>(
    server,
    '/orders/invoice',
    { token, query },
  );
}