import { Server } from 'http';
import type { Invoice } from '@cr7/types';
import { getJSON, postJSON } from '../lib/api.js';

type ApplyInvoicePayload = Pick<Invoice.InvoiceApplication, 'invoice_title' | 'email'> & {
  tax_no?: Invoice.InvoiceApplication['tax_no'];
};


export async function applyOrderInvoice(
  server: Server,
  orderId: string,
  payload: ApplyInvoicePayload,
  token: string,
) {
  return postJSON<Invoice.InvoiceApplication>(
    server,
    `/orders/${orderId}/invoice`,
    { body: payload, token },
  );
}

export async function listInvoiceApplications(
  server: Server,
  token: string,
  query: { oid?: Invoice.InvoiceApplication['order_id'] } = {},
) {
  return getJSON<Invoice.InvoiceApplicationListResult>(
    server,
    '/orders/invoice',
    { token, query },
  );
}