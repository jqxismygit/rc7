import { Server } from 'http';
import { Order } from '@cr7/types';
import { deleteJSON, getJSON, postJSON } from '../lib/api.js';

export async function createOrder(
  server: Server,
  eid: string,
  sid: string,
  items: Order.CreateOrderItem[],
  token: string,
) {
  return postJSON<Order.OrderWithItems>(
    server,
    `/exhibition/${eid}/sessions/${sid}/orders`,
    { body: { items }, token }
  );
}

export async function cancelOrder(
  server: Server,
  orderId: string,
  token: string,
) {
  return deleteJSON<null>(
    server,
    `/orders/${orderId}`,
    { token }
  );
}

export async function getOrder(
  server: Server,
  orderId: string,
  token: string,
) {
  return getJSON<Order.OrderWithItems>(
    server,
    `/orders/${orderId}`,
    { token }
  );
}

export async function listOrders(
  server: Server,
  token: string,
  query: {
    status?: Order.OrderStatus;
    page?: number;
    limit?: number;
  } = {},
) {
  return getJSON<Order.OrderListResult>(
    server,
    '/orders',
    { token, query }
  );
}
