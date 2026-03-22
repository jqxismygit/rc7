import { Pool, PoolClient } from 'pg';
import type { Order } from '@cr7/types';

type DBClient = Pool | PoolClient;

type CreateOrderInput = {
  user_id: string;
  exhibit_id: string;
  session_id: string;
  items: Order.CreateOrderItem[];
};

type AggregatedItem = {
  ticket_category_id: string;
  quantity: number;
};

type InventoryRow = {
  ticket_category_id: string;
  quantity: number;
  reserved_quantity: number;
};

type OrderLockRow = {
  id: string;
  user_id: string;
  session_id: string;
  released_at: string | null;
  status: Order.OrderStatus;
};

type ExpiredOrderRow = {
  id: string;
  session_id: string;
};

export const ORDER_STATUS_CASE = `
  CASE
    WHEN paid_at IS NOT NULL THEN 'PAID'
    WHEN cancelled_at IS NOT NULL THEN 'CANCELLED'
    WHEN expires_at < NOW() THEN 'EXPIRED'
    ELSE 'PENDING_PAYMENT'
  END
`;

export type ORDER_DATA_ERROR_CODES =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_STATUS_INVALID'
  | 'INVENTORY_NOT_ENOUGH'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'TICKET_CATEGORY_NOT_FOUND'
  | 'INVALID_ARGUMENT';

export class OrderDataError extends Error {
  code: ORDER_DATA_ERROR_CODES;

  constructor(message: string, code: ORDER_DATA_ERROR_CODES) {
    super(message);
    this.name = 'OrderDataError';
    this.code = code;
  }
}

function normalizeOrderItems(items: Order.CreateOrderItem[]): AggregatedItem[] {
  const quantityByTicketCategory = new Map<string, number>();

  for (const item of items) {
    const quantity = quantityByTicketCategory.get(item.ticket_category_id) ?? 0;
    quantityByTicketCategory.set(item.ticket_category_id, quantity + item.quantity);
  }

  return [...quantityByTicketCategory.entries()]
    .map(([ticket_category_id, quantity]) => ({ ticket_category_id, quantity }))
    .sort((a, b) => a.ticket_category_id.localeCompare(b.ticket_category_id));
}

function validateCreateItems(items: Order.CreateOrderItem[]) {
  if (Array.isArray(items) === false || items.length === 0) {
    throw new OrderDataError('Invalid order items', 'INVALID_ARGUMENT');
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      throw new OrderDataError('Invalid order item quantity', 'INVALID_ARGUMENT');
    }
  }
}

async function ensureSessionBelongsToExhibition(
  client: DBClient,
  schema: string,
  exhibitId: string,
  sessionId: string,
) {
  const { rows } = await client.query<{ id: string; is_expired: boolean }>(
    `SELECT
      id,
      (session_date < CURRENT_DATE) AS is_expired
    FROM ${schema}.exhibit_sessions
    WHERE id = $1
      AND session_id = $2`,
    [sessionId, exhibitId]
  );

  if (rows.length === 0) {
    throw new OrderDataError('Session not found', 'SESSION_NOT_FOUND');
  }

  if (rows[0].is_expired) {
    throw new OrderDataError('Session expired', 'SESSION_EXPIRED');
  }
}

async function getTicketCategoryPriceMap(
  client: DBClient,
  schema: string,
  exhibitId: string,
  ticketCategoryIds: string[]
): Promise<Map<string, number>> {
  const { rows } = await client.query(
    `SELECT id, price
    FROM ${schema}.exhibit_ticket_categories
    WHERE eid = $1
      AND id = ANY($2::uuid[])`,
    [exhibitId, ticketCategoryIds]
  );

  if (rows.length !== ticketCategoryIds.length) {
    throw new OrderDataError('Ticket category not found', 'TICKET_CATEGORY_NOT_FOUND');
  }

  return new Map(rows.map(row => [row.id, row.price]));
}

async function lockInventories(
  client: DBClient,
  schema: string,
  sessionId: string,
  ticketCategoryIds: string[]
): Promise<Map<string, InventoryRow>> {
  const { rows } = await client.query<InventoryRow>(
    `SELECT
      ticket_category_id,
      quantity,
      reserved_quantity
    FROM ${schema}.exhibit_session_inventories
    WHERE session_id = $1
      AND ticket_category_id = ANY($2::uuid[])
    ORDER BY ticket_category_id
    FOR UPDATE`,
    [sessionId, ticketCategoryIds]
  );

  return new Map(rows.map(row => [row.ticket_category_id, row]));
}

async function getOrderItemsByOrderId(
  client: DBClient,
  schema: string,
  orderId: string,
): Promise<Order.OrderItem[]> {
  const { rows } = await client.query<Order.OrderItem>(
    `SELECT
      id,
      order_id,
      ticket_category_id,
      quantity,
      unit_price,
      subtotal,
      created_at,
      updated_at
    FROM ${schema}.exhibit_order_items
    WHERE order_id = $1
    ORDER BY created_at`,
    [orderId]
  );

  return rows;
}

async function getOrderItemsByOrderIds(
  client: DBClient,
  schema: string,
  orderIds: string[],
): Promise<Map<string, Order.OrderItem[]>> {
  if (orderIds.length === 0) {
    return new Map();
  }

  const { rows } = await client.query<Order.OrderItem>(
    `SELECT
      id,
      order_id,
      ticket_category_id,
      quantity,
      unit_price,
      subtotal,
      created_at,
      updated_at
    FROM ${schema}.exhibit_order_items
    WHERE order_id = ANY($1::uuid[])
    ORDER BY created_at`,
    [orderIds]
  );

  const itemsByOrderId = new Map<string, Order.OrderItem[]>();

  for (const item of rows) {
    const items = itemsByOrderId.get(item.order_id) ?? [];
    items.push(item);
    itemsByOrderId.set(item.order_id, items);
  }

  return itemsByOrderId;
}

export async function getOrderById(
  client: DBClient,
  schema: string,
  orderId: string,
  userId: string
): Promise<Order.OrderWithItems> {
  const { rows } = await client.query<Omit<Order.OrderWithItems, 'items'>>(
    `SELECT
      id,
      user_id,
      exhibit_id,
      session_id,
      ${ORDER_STATUS_CASE} AS status,
      total_amount,
      expires_at,
      paid_at,
      cancelled_at,
      released_at,
      created_at,
      updated_at
    FROM ${schema}.exhibit_orders
    WHERE id = $1
      AND user_id = $2`,
    [orderId, userId]
  );

  if (rows.length === 0) {
    throw new OrderDataError('Order not found', 'ORDER_NOT_FOUND');
  }

  const [order] = rows;
  const items = await getOrderItemsByOrderId(client, schema, orderId);

  return { ...order, items };
}

export async function getOrders(
  client: DBClient,
  schema: string,
  userId: string,
  options: {
    status?: Order.OrderStatus;
    page: number;
    limit: number;
  },
): Promise<Order.OrderListResult> {
  const { status, page, limit } = options;
  const offset = (page - 1) * limit;

  const { rows: countRows } = await client.query<{ total: string }>(
    `WITH order_rows AS (
      SELECT
        id,
        ${ORDER_STATUS_CASE} AS status
      FROM ${schema}.exhibit_orders
      WHERE user_id = $1
    )
    SELECT COUNT(*)::text AS total
    FROM order_rows
    WHERE ($2::text IS NULL OR status = $2)`,
    [userId, status ?? null]
  );

  const total = parseInt(countRows[0].total, 10);

  const { rows: orders } = await client.query<Omit<Order.OrderWithItems, 'items'>>(
    `WITH order_rows AS (
      SELECT
        id,
        user_id,
        exhibit_id,
        session_id,
        ${ORDER_STATUS_CASE} AS status,
        total_amount,
        expires_at,
        paid_at,
        cancelled_at,
        released_at,
        created_at,
        updated_at
      FROM ${schema}.exhibit_orders
      WHERE user_id = $1
    )
    SELECT
      id,
      user_id,
      exhibit_id,
      session_id,
      status,
      total_amount,
      expires_at,
      paid_at,
      cancelled_at,
      released_at,
      created_at,
      updated_at
    FROM order_rows
    WHERE ($2::text IS NULL OR status = $2)
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4`,
    [userId, status ?? null, limit, offset]
  );

  const orderIds = orders.map(order => order.id);
  const itemsByOrderId = await getOrderItemsByOrderIds(client, schema, orderIds);

  return {
    orders: orders.map(order => ({
      ...order,
      items: itemsByOrderId.get(order.id) ?? [],
    })),
    total,
    page,
    limit,
  };
}

export async function createOrder(
  client: DBClient,
  schema: string,
  input: CreateOrderInput,
): Promise<Order.OrderWithItems> {
  validateCreateItems(input.items);

  const aggregatedItems = normalizeOrderItems(input.items);
  const ticketCategoryIds = aggregatedItems.map(item => item.ticket_category_id);

  await ensureSessionBelongsToExhibition(
    client,
    schema,
    input.exhibit_id,
    input.session_id,
  );

  const priceMap = await getTicketCategoryPriceMap(
    client,
    schema,
    input.exhibit_id,
    ticketCategoryIds,
  );

  const inventoryMap = await lockInventories(
    client,
    schema,
    input.session_id,
    ticketCategoryIds,
  );

  for (const item of aggregatedItems) {
    const inventory = inventoryMap.get(item.ticket_category_id);
    const available = (inventory?.quantity ?? 0) - (inventory?.reserved_quantity ?? 0);

    if (available < item.quantity) {
      throw new OrderDataError('Inventory not enough', 'INVENTORY_NOT_ENOUGH');
    }
  }

  const totalAmount = aggregatedItems.reduce((sum, item) => {
    const price = priceMap.get(item.ticket_category_id) ?? 0;
    return sum + (price * item.quantity);
  }, 0);

  const { rows: [createdOrder] } = await client.query<{ id: string }>(
    `INSERT INTO ${schema}.exhibit_orders (
      user_id,
      exhibit_id,
      session_id,
      total_amount,
      expires_at
    )
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 minutes')
    RETURNING id`,
    [input.user_id, input.exhibit_id, input.session_id, totalAmount]
  );

  for (const item of aggregatedItems) {
    const unitPrice = priceMap.get(item.ticket_category_id)!;
    const subtotal = unitPrice * item.quantity;

    await client.query(
      `INSERT INTO ${schema}.exhibit_order_items (
        order_id,
        ticket_category_id,
        quantity,
        unit_price,
        subtotal
      )
      VALUES ($1, $2, $3, $4, $5)`,
      [createdOrder.id, item.ticket_category_id, item.quantity, unitPrice, subtotal]
    );

    await client.query(
      `UPDATE ${schema}.exhibit_session_inventories
      SET
        reserved_quantity = reserved_quantity + $3,
        updated_at = NOW()
      WHERE session_id = $1
        AND ticket_category_id = $2`,
      [input.session_id, item.ticket_category_id, item.quantity]
    );
  }

  return getOrderById(client, schema, createdOrder.id, input.user_id);
}

async function lockOrderForCancel(
  client: DBClient,
  schema: string,
  orderId: string,
  userId: string
): Promise<OrderLockRow> {
  const { rows } = await client.query<OrderLockRow>(
    `SELECT
      id,
      user_id,
      session_id,
      released_at,
      ${ORDER_STATUS_CASE} AS status
    FROM ${schema}.exhibit_orders
    WHERE id = $1
      AND user_id = $2
    FOR UPDATE`,
    [orderId, userId]
  );

  if (rows.length === 0) {
    throw new OrderDataError('Order not found', 'ORDER_NOT_FOUND');
  }

  return rows[0];
}

async function releaseOrderInventory(
  client: DBClient,
  schema: string,
  orderId: string,
  sessionId: string,
) {
  const { rows: items } = await client.query<AggregatedItem>(
    `SELECT
      ticket_category_id,
      SUM(quantity)::int AS quantity
    FROM ${schema}.exhibit_order_items
    WHERE order_id = $1
    GROUP BY ticket_category_id
    ORDER BY ticket_category_id`,
    [orderId]
  );

  if (items.length === 0) {
    return;
  }

  const ticketCategoryIds = items.map(item => item.ticket_category_id);
  await lockInventories(client, schema, sessionId, ticketCategoryIds);

  for (const item of items) {
    await client.query(
      `UPDATE ${schema}.exhibit_session_inventories
      SET
        reserved_quantity = GREATEST(reserved_quantity - $3, 0),
        updated_at = NOW()
      WHERE session_id = $1
        AND ticket_category_id = $2`,
      [sessionId, item.ticket_category_id, item.quantity]
    );
  }
}

export async function cancelOrder(
  client: DBClient,
  schema: string,
  orderId: string,
  userId: string,
) {
  const order = await lockOrderForCancel(client, schema, orderId, userId);

  if (order.status === 'PENDING_PAYMENT') {
    if (order.released_at === null) {
      await releaseOrderInventory(client, schema, order.id, order.session_id);
    }

    await client.query(
      `UPDATE ${schema}.exhibit_orders
      SET
        cancelled_at = COALESCE(cancelled_at, NOW()),
        released_at = COALESCE(released_at, NOW()),
        updated_at = NOW()
      WHERE id = $1`,
      [order.id]
    );

    return;
  }

  if (order.status === 'CANCELLED') {
    return;
  }

  throw new OrderDataError('Order status invalid', 'ORDER_STATUS_INVALID');
}

async function lockExpiredOrders(
  client: DBClient,
  schema: string,
  now: Date,
  batchSize: number,
): Promise<ExpiredOrderRow[]> {
  const { rows } = await client.query<ExpiredOrderRow>(
    `SELECT
      id,
      session_id
    FROM ${schema}.exhibit_orders
    WHERE paid_at IS NULL
      AND cancelled_at IS NULL
      AND expires_at < $1
      AND released_at IS NULL
    ORDER BY expires_at
    LIMIT $2
    FOR UPDATE SKIP LOCKED`,
    [now.toISOString(), batchSize]
  );

  return rows;
}

export async function releaseExpiredOrders(
  client: DBClient,
  schema: string,
  now: Date,
  batchSize: number,
): Promise<number> {
  const orders = await lockExpiredOrders(client, schema, now, batchSize);

  for (const order of orders) {
    await releaseOrderInventory(client, schema, order.id, order.session_id);

    await client.query(
      `UPDATE ${schema}.exhibit_orders
      SET
        released_at = COALESCE(released_at, NOW()),
        updated_at = NOW()
      WHERE id = $1`,
      [order.id]
    );
  }

  return orders.length;
}
