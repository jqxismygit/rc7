import type { Exhibition as ExhibitionTypes } from "@cr7/types";
import { request } from "@/utils/request";

export type CreateExhibitionInput = Omit<
  ExhibitionTypes.Exhibition,
  "id" | "created_at" | "updated_at"
>;

export const createExhibitionApi = async (data: CreateExhibitionInput) => {
  // 后端：POST /exhibition
  return request.post("/exhibition", data);
};

