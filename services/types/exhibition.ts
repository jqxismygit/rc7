export type ExhibitionStatus = 'ENABLE' | 'DISABLE';

export interface Exhibition {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  opening_time: string;
  closing_time: string;
  last_entry_time: string;
  city: string;
  venue_name: string;
  location: string;
  cover_url?: string | null;
  status: ExhibitionStatus;
  created_at: Date;
  updated_at: Date;
}

export type ExhibitionDraft = Partial<Pick<Exhibition,
  'name' |
  'description' |
  'start_date' |
  'end_date' |
  'opening_time' |
  'closing_time' |
  'last_entry_time' |
  'city' |
  'venue_name' |
  'location' |
  'cover_url'
>>;

export type ExhibitionPatch = Partial<Omit<ExhibitionDraft,
  'start_date' |
  'end_date'
>>;

export interface TicketCategory {
  id: string;
  exhibit_id: string;
  name: string;
  price: number; // 单位为分
  valid_duration_days: number;
  refund_policy: "NON_REFUNDABLE" | "REFUNDABLE_48H_BEFORE";
  admittance: number;
  ota_xc_option_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export type TicketCategoryPatch = Partial<Pick<TicketCategory,
  'name' |
  'price' |
  'valid_duration_days' |
  'refund_policy' |
  'admittance'
>>;

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
