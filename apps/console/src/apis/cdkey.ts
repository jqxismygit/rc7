import type { Cdkey as CdkeyTypes } from "@cr7/types";
import { request } from "@/utils/request";

export type CreateCdkeyBatchInput = {
  eid: string;
  name: string;
  ticket_category_id: string;
  redeem_quantity: 1;
  quantity: number;
  redeem_valid_until: string;
};

export type ListCdkeyBatchesQuery = {
  eid: string;
  page?: number;
  limit?: number;
};

export type ListBatchCdkeysQuery = {
  bid: string;
  page?: number;
  limit?: number;
};

/** 管理员创建兑换码批次 `POST /cdkeys/batches` */
export async function createCdkeyBatchApi(
  data: CreateCdkeyBatchInput,
): Promise<CdkeyTypes.CreateCdkeyBatchResult> {
  const raw = await request.post("/cdkeys/batches", data);
  return raw as unknown as CdkeyTypes.CreateCdkeyBatchResult;
}

/** 管理员分页查询兑换码批次 `GET /cdkeys/batches` */
export async function listCdkeyBatchesApi(
  params: ListCdkeyBatchesQuery,
): Promise<CdkeyTypes.CdkeyBatchListResult> {
  const raw = await request.get("/cdkeys/batches", { params });
  return raw as unknown as CdkeyTypes.CdkeyBatchListResult;
}

/** 管理员分页查询批次下兑换码 `GET /cdkeys/batches/:bid/codes` */
export async function listBatchCdkeysApi(
  params: ListBatchCdkeysQuery,
): Promise<CdkeyTypes.CdkeyListResult> {
  const { bid, page, limit } = params;
  const raw = await request.get(`/cdkeys/batches/${encodeURIComponent(bid)}/codes`, {
    params: { page, limit },
  });
  return raw as unknown as CdkeyTypes.CdkeyListResult;
}

/** 管理员查询单个兑换码详情 `GET /cdkeys/:code` */
export async function getCdkeyDetailApi(code: string): Promise<CdkeyTypes.Cdkey> {
  const raw = await request.get(`/cdkeys/${encodeURIComponent(code)}`);
  return raw as unknown as CdkeyTypes.Cdkey;
}
