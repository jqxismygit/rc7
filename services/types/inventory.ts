import type { TicketCategory } from "./exhibition.js";

export interface SessionInventory {
  id: string;
  session_id: string;
  ticket_category_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface SessionTicketsInventory extends TicketCategory {
  session_id: string;
  quantity: number;
}

export interface TicketCalendarInventory {
  session_id: string;
  session_date: string;
  quantity: number;
  price: number;
}
