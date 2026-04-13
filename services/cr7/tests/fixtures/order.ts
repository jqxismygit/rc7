import { Server } from 'http';
import type { Pool } from 'pg';
import type { ServiceBroker } from 'moleculer';
import { Order } from '@cr7/types';
import { deleteJSON, getJSON, patchJSON, postJSON } from '../lib/api.js';

type Cr7ServiceWithPool = {
  pool: Pick<Pool, 'query'>;
};

export async function createOrder(
  server: Server,
  eid: string,
  sid: string,
  items: Order.CreateOrderItem[],
  token: string,
  source: Order.OrderSource = 'DIRECT',
) {
  return postJSON<Order.OrderWithItems>(
    server,
    `/exhibition/${eid}/sessions/${sid}/orders`,
    { body: { items, source }, token }
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


export async function getOrderAdmin(
  server: Server,
  orderId: string,
  token: string,
) {
  return getJSON<Order.OrderWithItems>(
    server,
    `/admin/orders/${orderId}`,
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

export async function hideOrder(
  server: Server,
  orderId: string,
  token: string,
) {
  return patchJSON<null>(
    server,
    `/orders/${orderId}/hide`,
    { token }
  );
}

export async function listOrdersAdmin(
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
    '/admin/orders',
    { token, query }
  );
}

export async function expireOrder(
  broker: ServiceBroker,
  schema: string,
  orderId: string,
) {
  const cr7Service = broker.getLocalService('cr7') as unknown as Cr7ServiceWithPool;

  await cr7Service.pool.query(
    `UPDATE ${schema}.exhibit_orders
    SET expires_at = NOW() - INTERVAL '1 minute',
        updated_at = NOW()
    WHERE id = $1`,
    [orderId],
  );
}
