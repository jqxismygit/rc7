import { Server } from 'http';
import type { Pool } from 'pg';
import type { ServiceBroker } from 'moleculer';
import { Order } from '@cr7/types';
import { expect } from 'vitest';
import { deleteJSON, getJSON, patchJSON, postJSON } from '../lib/api.js';

export function assertOrderWithItems(data: unknown): asserts data is Order.OrderWithItems {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('id', expect.any(String));
  expect(data).toHaveProperty('user_id', expect.any(String));
  expect(data).toHaveProperty('exhibit_id', expect.any(String));
  expect(data).toHaveProperty('session_id', expect.any(String));
  expect(data).toHaveProperty('session_half', expect.toBeOneOf([expect.stringMatching(/^(AM|PM)$/), null]));
  expect(data).toHaveProperty('session_date', expect.any(String));
  expect(data).toHaveProperty('current_refund_out_refund_no', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('status', expect.stringMatching(/^(PENDING_PAYMENT|PAID|REFUND_REQUESTED|REFUND_PROCESSING|REFUNDED|REFUND_FAILED|CANCELLED|EXPIRED)$/));
  expect(data).toHaveProperty('total_amount', expect.any(Number));
  expect(data).toHaveProperty('expires_at', expect.any(String));
  expect(data).toHaveProperty('paid_at', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('cancelled_at', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('released_at', expect.toBeOneOf([expect.any(String), null]));
  expect(data).toHaveProperty('source', expect.stringMatching(/^(DIRECT|CTRIP|MOP|DAMAI)$/));
  expect(data).toHaveProperty('created_at', expect.any(String));
  expect(data).toHaveProperty('updated_at', expect.any(String));
  expect(data).toHaveProperty('invoice', expect.toBeOneOf([
    null,
    expect.objectContaining({
      id: expect.any(String),
      invoice_title: expect.any(String),
      email: expect.any(String),
      status: expect.stringMatching(/^(PENDING|SUCCESS|FAILED)$/),
    }),
  ]));

  if (((data as { status: string }).status).startsWith('REFUND')) {
    expect(data).toHaveProperty('refund', expect.objectContaining({
      out_refund_no: expect.any(String),
      reason: expect.any(String),
      status: expect.stringMatching(/^(REQUESTED|PROCESSING|SUCCEEDED|FAILED)$/),
    }));
  } else {
    expect(data).toHaveProperty('refund', null);
  }

  expect(data).toHaveProperty('exhibition');
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('id', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('name', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('description', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('location', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('city', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('venue_name', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('start_date', expect.any(String));
  expect((data as Order.OrderWithItems).exhibition).toHaveProperty('end_date', expect.any(String));

  expect(data).toHaveProperty('session');
  expect((data as Order.OrderWithItems).session).toHaveProperty('id', expect.any(String));
  expect((data as Order.OrderWithItems).session).toHaveProperty('session_date', expect.any(String));
  expect((data as Order.OrderWithItems).session).toHaveProperty('opening_time', expect.any(String));
  expect((data as Order.OrderWithItems).session).toHaveProperty('closing_time', expect.any(String));
  expect((data as Order.OrderWithItems).session).toHaveProperty('last_entry_time', expect.any(String));

  expect(data).toHaveProperty('items', expect.any(Array));
  for (const item of (data as Order.OrderWithItems).items) {
    expect(item).toHaveProperty('id', expect.any(String));
    expect(item).toHaveProperty('order_id', expect.any(String));
    expect(item).toHaveProperty('ticket_category_id', expect.any(String));
    expect(item).toHaveProperty('ticket_category_name', expect.any(String));
    expect(item).toHaveProperty('quantity', expect.any(Number));
    expect(item).toHaveProperty('unit_price', expect.any(Number));
    expect(item).toHaveProperty('subtotal', expect.any(Number));
    expect(item).toHaveProperty('created_at', expect.any(String));
    expect(item).toHaveProperty('updated_at', expect.any(String));
  }
}

export function assertOrderListResult(data: unknown): asserts data is Order.OrderListResult {
  expect(data).toBeTypeOf('object');
  expect(data).toHaveProperty('orders', expect.any(Array));
  expect(data).toHaveProperty('total', expect.any(Number));
  expect(data).toHaveProperty('page', expect.any(Number));
  expect(data).toHaveProperty('limit', expect.any(Number));
  for (const order of (data as Order.OrderListResult).orders) {
    assertOrderWithItems(order);
  }
}

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
  const result = await postJSON<Order.OrderWithItems>(
    server,
    `/exhibition/${eid}/sessions/${sid}/orders`,
    { body: { items, source }, token }
  );
  assertOrderWithItems(result);
  return result;
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
  const result = await getJSON<Order.OrderWithItems>(
    server,
    `/orders/${orderId}`,
    { token }
  );
  assertOrderWithItems(result);
  return result;
}

export async function getOrderAdmin(
  server: Server,
  orderId: string,
  token: string,
) {
  const result = await getJSON<Order.OrderWithItems>(
    server,
    `/admin/orders/${orderId}`,
    { token }
  );
  assertOrderWithItems(result);
  return result;
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
  const result = await getJSON<Order.OrderListResult>(
    server,
    '/orders',
    { token, query }
  );
  assertOrderListResult(result);
  return result;
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
  const result = await getJSON<Order.OrderListResult>(
    server,
    '/admin/orders',
    { token, query }
  );
  assertOrderListResult(result);
  return result;
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
