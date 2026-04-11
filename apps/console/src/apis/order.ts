import type { Order as OrderTypes } from "@cr7/types";
import { request } from "@/utils/request";

export type AdminOrdersQuery = {
  status?: OrderTypes.OrderStatus;
  page?: number;
  limit?: number;
};

/** 管理员订单列表 `GET /admin/orders` */
export async function listAdminOrdersApi(
  params: AdminOrdersQuery,
): Promise<OrderTypes.OrderListResult> {
  const raw = await request.get("/admin/orders", { params });
  return raw as unknown as OrderTypes.OrderListResult;
}
