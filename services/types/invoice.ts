export type InvoiceStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface InvoiceRecord {
  id: string;
  order_id: string;
  invoice_title: string;
  tax_no: string;
  email: string;
  status: InvoiceStatus;
  sequence_id: string;
  invoice_no: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListResult {
  items: InvoiceRecord[];
}