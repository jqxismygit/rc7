export type InvoiceApplicationStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface InvoiceApplication {
  id: string;
  order_id: string;
  invoice_title: string;
  tax_no: string;
  email: string;
  status: InvoiceApplicationStatus;
  sequence_id: string;
  invoice_no: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceApplicationListResult {
  items: InvoiceApplication[];
}