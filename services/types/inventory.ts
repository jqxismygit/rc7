import type { TicketCategory } from "./exhibition.js";

export interface SessionInventory {
  id: string;
  session_id: string;
  ticket_category_id: string;
  quantity: number;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface SessionTicketPrice extends TicketCategory {
  session_id: string;
  /**
   * @deprecated
   */
  quantity: number;
  price: number;
}

export interface TicketCalendarInventory {
  session_id: string;
  session_date: string;
  inventory: number; // 总库存
  quantity: number; // 可用库存
  price: number;
  list_price: number;
}
