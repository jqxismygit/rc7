export interface Exhibition {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  opening_time: string;
  closing_time: string;
  last_entry_time: string;
  location: string;
  created_at: Date;
  updated_at: Date;
}

export interface TicketCategory {
  id: string;
  exhibit_id: string;
  name: string;
  price: number;
  valid_duration_days: number;
  refund_policy: 'NON_REFUNDABLE' | 'REFUNDABLE_48H_BEFORE';
  admittance: number;
  created_at: Date;
  updated_at: Date;
}

export interface ExhibitionWithCategories extends Exhibition {
  ticket_categories: TicketCategory[];
}

export interface Session {
  id: string;
  exhibit_id: string;
  session_date: Date;
  created_at: Date;
  updated_at: Date;
}

