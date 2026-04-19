import type {
  Exhibition as ExhibitionTypes,
  Inventory as InventoryTypes,
} from "@cr7/types";
import { request } from "@/utils/request";

export type SessionTicketsInventory = InventoryTypes.SessionInventory;

export type CreateExhibitionInput = Omit<
  ExhibitionTypes.Exhibition,
  "id" | "created_at" | "updated_at"
>;

export type ExhibitionListQuery = {
  limit?: number;
  offset?: number;
  all?: boolean;
};

export type ExhibitionListResponse = {
  data: ExhibitionTypes.Exhibition[];
  total: number;
  limit: number;
  offset: number;
};

export async function listExhibitionsApi(
  params: ExhibitionListQuery,
): Promise<ExhibitionListResponse> {
  const raw = await request.get("/exhibition", {
    params: { ...params, all: true },
  });
  return raw as unknown as ExhibitionListResponse;
}

export async function createExhibitionApi(
  data: CreateExhibitionInput,
): Promise<ExhibitionTypes.Exhibition> {
  const raw = await request.post("/exhibition", data);
  return raw as unknown as ExhibitionTypes.Exhibition;
}

export async function updateExhibitionApi(
  eid: string,
  data: ExhibitionTypes.ExhibitionPatch,
): Promise<ExhibitionTypes.Exhibition> {
  const raw = await request.patch(
    `/exhibition/${encodeURIComponent(eid)}`,
    data,
  );
  return raw as unknown as ExhibitionTypes.Exhibition;
}

/** 更新展览上下线状态，响应 204 */
export async function updateExhibitionStatusApi(
  eid: string,
  status: ExhibitionTypes.ExhibitionStatus,
): Promise<void> {
  await request.patch(`/exhibition/${encodeURIComponent(eid)}/status`, {
    status,
  });
}

export async function getExhibitionSessionsApi(
  eid: string,
): Promise<ExhibitionTypes.Session[]> {
  const raw = await request.get(
    `/exhibition/${encodeURIComponent(eid)}/sessions`,
  );
  return raw as unknown as ExhibitionTypes.Session[];
}

export type CreateTicketCategoryInput = Omit<
  ExhibitionTypes.TicketCategory,
  "id" | "exhibit_id" | "created_at" | "updated_at"
>;

export type UpdateTicketCategoryInput = ExhibitionTypes.TicketCategoryPatch;

export async function listExhibitionTicketsApi(
  eid: string,
): Promise<ExhibitionTypes.TicketCategory[]> {
  const raw = await request.get(
    `/exhibition/${encodeURIComponent(eid)}/tickets`,
  );
  return raw as unknown as ExhibitionTypes.TicketCategory[];
}

export async function createExhibitionTicketCategoryApi(
  eid: string,
  data: CreateTicketCategoryInput,
): Promise<ExhibitionTypes.TicketCategory> {
  const raw = await request.post(
    `/exhibition/${encodeURIComponent(eid)}/tickets`,
    data,
  );
  return raw as unknown as ExhibitionTypes.TicketCategory;
}

export async function updateExhibitionTicketCategoryApi(
  eid: string,
  tid: string,
  data: UpdateTicketCategoryInput,
): Promise<ExhibitionTypes.TicketCategory> {
  const raw = await request.patch(
    `/exhibition/${encodeURIComponent(eid)}/tickets/${encodeURIComponent(tid)}`,
    data,
  );
  return raw as unknown as ExhibitionTypes.TicketCategory;
}

export async function getExhibitionApi(eid: string): Promise<
  ExhibitionTypes.Exhibition & {
    sessions: ExhibitionTypes.Session[];
    ticket_categories: ExhibitionTypes.TicketCategory[];
  }
> {
  const [exhibition, sessions, ticket_categories] = await Promise.all([
    request.get(`/exhibition/${encodeURIComponent(eid)}`),
    request.get(`/exhibition/${encodeURIComponent(eid)}/sessions`),
    request.get(`/exhibition/${encodeURIComponent(eid)}/tickets`),
  ]);
  return {
    ...exhibition,
    sessions: sessions,
    ticket_categories: ticket_categories,
  } as unknown as ExhibitionTypes.Exhibition & {
    sessions: ExhibitionTypes.Session[];
    ticket_categories: ExhibitionTypes.TicketCategory[];
  };
}

// /exhibition/:eid/sessions/:sid/tickets
export async function listExhibitionSessionTicketsApi(
  eid: string,
  sid: string,
): Promise<SessionTicketsInventory[]> {
  const raw = await request.get(
    `/exhibition/${encodeURIComponent(eid)}/sessions/${encodeURIComponent(sid)}/tickets`,
  );
  return raw as unknown as SessionTicketsInventory[];
}

export async function createExhibitionSessionTicketApi(
  eid: string,
  sid: string,
  data: Omit<
    SessionTicketsInventory,
    "id" | "session_id" | "created_at" | "updated_at"
  >,
): Promise<SessionTicketsInventory> {
  const raw = await request.post(
    `/exhibition/${encodeURIComponent(eid)}/sessions/${encodeURIComponent(sid)}/tickets`,
    data,
  );
  return raw as unknown as SessionTicketsInventory;
}

/** 批量设置某票种在所有场次下的库存上限，响应 204 */
export async function updateTicketCategoryInventoryMaxApi(
  eid: string,
  tid: string,
  quantity: number,
): Promise<void> {
  await request.put(
    `/exhibition/${encodeURIComponent(eid)}/sessions/tickets/${encodeURIComponent(tid)}/inventory/max`,
    { quantity },
  );
}

/** 同步展览项目到猫眼（MOP），响应 204 */
export async function syncExhibitionToMopApi(eid: string): Promise<void> {
  await request.post(`/exhibition/${encodeURIComponent(eid)}/ota/mop/sync`);
}

/** MOP 按场次日期区间同步时请求体（与 docs/api/mop.md 一致） */
export type MopSessionDateRangeBody = {
  sessionDateStart?: string;
  sessionDateEnd?: string;
};

/** 同步票种信息到 MOP，响应 204 */
export async function syncMopTicketsApi(
  eid: string,
  body: MopSessionDateRangeBody,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/ota/mop/sync/tickets`,
    body,
  );
}

/** 同步场次信息到 MOP，响应 204 */
export async function syncMopSessionsApi(
  eid: string,
  body: MopSessionDateRangeBody,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/ota/mop/sync/sessions`,
    body,
  );
}

/** 同步库存信息到 MOP，响应 204 */
export async function syncMopStocksApi(
  eid: string,
  body: MopSessionDateRangeBody,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/ota/mop/sync/stocks`,
    body,
  );
}

/** 同步展览项目到大麦，响应 204 */
export async function syncExhibitionToDamaiApi(eid: string): Promise<void> {
  await request.post(`/exhibition/${encodeURIComponent(eid)}/ota/damai/sync`);
}

/** 大麦按场次日期区间同步（与 docs/api/damai.md 一致，snake_case） */
export type DamaiSessionDateRangeBody = {
  start_session_date?: string;
  end_session_date?: string;
};

/** 同步场次信息到大麦，响应 204 */
export async function syncDamaiSessionsApi(
  eid: string,
  body: DamaiSessionDateRangeBody,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/ota/damai/sync/sessions`,
    body,
  );
}

/** 同步指定场次下票种（价格）到大麦，响应 204 */
export async function syncDamaiSessionTicketsApi(
  eid: string,
  sid: string,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/sessions/${encodeURIComponent(sid)}/ota/damai/sync/tickets`,
  );
}

/** 携程按场次日期区间同步（与 docs/api/xiecheng.md 一致，snake_case） */
export type XiechengSessionDateRangeBody = {
  start_session_date: string;
  end_session_date: string;
};

/** 同步票种场次库存至携程；不传 quantity 时按各场次剩余库存同步 */
export async function syncXiechengTicketInventoryApi(
  eid: string,
  tid: string,
  body: XiechengSessionDateRangeBody,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/tickets/${encodeURIComponent(tid)}/ota/xc/sync/inventory`,
    body,
  );
}

/** 同步票种场次价格至携程 */
export async function syncXiechengTicketPricesApi(
  eid: string,
  tid: string,
  body: XiechengSessionDateRangeBody,
): Promise<void> {
  await request.post(
    `/exhibition/${encodeURIComponent(eid)}/tickets/${encodeURIComponent(tid)}/ota/xc/sync/prices`,
    body,
  );
}
