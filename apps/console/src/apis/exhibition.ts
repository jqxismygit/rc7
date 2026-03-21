import type { Exhibition as ExhibitionTypes } from "@cr7/types";
import { request } from "@/utils/request";

export type CreateExhibitionInput = Omit<
  ExhibitionTypes.Exhibition,
  "id" | "created_at" | "updated_at"
>;

export type ExhibitionListQuery = {
  limit?: number;
  offset?: number;
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
  const raw = await request.get("/exhibition", { params });
  return raw as unknown as ExhibitionListResponse;
}

export async function createExhibitionApi(
  data: CreateExhibitionInput,
): Promise<ExhibitionTypes.Exhibition> {
  const raw = await request.post("/exhibition", data);
  return raw as unknown as ExhibitionTypes.Exhibition;
}

export async function getExhibitionSessionsApi(
  eid: string,
): Promise<ExhibitionTypes.Session[]> {
  const raw = await request.get(
    `/exhibition/${encodeURIComponent(eid)}/sessions`,
  );
  return raw as unknown as ExhibitionTypes.Session[];
}

export async function getExhibitionApi(
  eid: string,
): Promise<
  ExhibitionTypes.Exhibition & { sessions: ExhibitionTypes.Session[] }
> {
  // const raw = await request.get(`/exhibition/${encodeURIComponent(eid)}`);
  const [exhibition, sessions] = await Promise.all([
    request.get(`/exhibition/${encodeURIComponent(eid)}`),
    request.get(`/exhibition/${encodeURIComponent(eid)}/sessions`),
  ]);
  return {
    ...exhibition,
    sessions: sessions,
  } as unknown as ExhibitionTypes.Exhibition & {
    sessions: ExhibitionTypes.Session[];
  };
}
