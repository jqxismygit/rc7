# Order 接口实现设计（修订版）

本文档基于以下约束进行修订：

- user_id 使用 string（UUID）语义。
- 扣库存时不再修改库存总量字段 quantity，而是新增“已占用”字段。
- 订单过期释放库存时，在 order 表记录 released_at，避免重复释放。

## 1. 目标与边界

### 1.1 目标

- 实现 order 相关接口：创建订单、订单详情、订单列表、取消订单、过期处理。
- 确保并发下不超卖。
- 保证过期释放库存幂等。

### 1.2 非目标

- 不实现真实支付网关，仅保留支付接口占位。
- 不改变现有 exhibition、session、ticket category 领域模型。

## 2. 数据模型修订

### 2.1 现有库存表修订

表：exhibit_session_inventories

现有字段（关键）：
- quantity: INTEGER NOT NULL DEFAULT 0（库存总量）

新增字段：
- reserved_quantity: INTEGER NOT NULL DEFAULT 0

约束：
- CHECK (reserved_quantity >= 0)
- CHECK (reserved_quantity <= quantity)

含义：
- quantity 表示可售库存上限（静态配置值），不在下单时直接减少。
- reserved_quantity 表示当前已被待支付订单占用的库存数量。
- 可售余量由公式计算：available = quantity - reserved_quantity。

### 2.2 在订单表新增 released_at 字段（防重复释放）

表：exhibit_orders

新增字段：
- released_at TIMESTAMPTZ

建议约束：
- CHECK (released_at IS NULL OR paid_at IS NULL)

说明：
- released_at 表示“该订单占用库存已释放”的时间。
- 取消和过期都属于释放行为，写 released_at 即可表达“已释放且不可重复释放”。
- 幂等由条件更新保证：仅 released_at IS NULL 的订单允许执行释放逻辑。

### 2.3 订单状态保持

在 data 层查询订单时使用 SQL CASE 计算状态：
- PAID
- REFUND_REQUESTED
- REFUND_PROCESSING
- REFUNDED
- REFUND_FAILED
- CANCELLED
- EXPIRED
- PENDING_PAYMENT

说明：
- cancelled_at 目前只有用户取消订单时写入，过期订单不写 cancelled_at，仅依赖 expires_at < now() 呈现 EXPIRED 状态。
- 保留 EXPIRED 语义，不写 cancelled_at，仅依赖 expires_at < now() 呈现 EXPIRED。
- released_at 仅用于库存释放幂等控制，不参与状态计算。

## 3. 接口设计与实现流程

### 3.1 创建订单

接口：POST /exhibition/:eid/sessions/:sid/orders

输入：
- items: Order.CreateOrderItem[]

事务流程：
1. 校验场次 sid 属于展览 eid。
2. 对 items 按 ticket_category_id 聚合（避免重复票种导致重复扣占用）。
3. 读取票价并计算总价。
4. 读取并锁定库存行（FOR UPDATE）。
5. 用 available = quantity - reserved_quantity 校验是否足够。
6. 写入 exhibit_orders、exhibit_order_items。
7. 更新库存占用字段：reserved_quantity += 下单数量。
8. 提交事务并返回 OrderWithItems。

并发安全：
- 核心依赖 FOR UPDATE 行锁 + 单事务。
- 多票种建议按 ticket_category_id 排序后加锁，降低死锁概率。

### 3.2 获取订单详情

接口：GET /orders/:oid

规则：
- 仅允许查看当前登录用户自己的订单（WHERE id = :oid AND user_id = :uid）。
- 返回订单主信息 + items。

### 3.3 获取订单列表

接口：GET /orders

查询参数：
- status（可选）
- page（默认 1）
- limit（默认 20）

规则：
- 仅返回当前用户订单。

### 3.4 取消订单

接口：DELETE /orders/:oid

事务流程：
1. 锁定订单行 FOR UPDATE，并校验属于当前用户。
2. 仅 PENDING_PAYMENT 可取消。
3. 仅当 released_at IS NULL 时执行释放逻辑（否则直接返回 204，幂等成功）。
4. 更新库存占用字段：reserved_quantity -= 订单项数量。
5. 更新订单 cancelled_at = now(), released_at = now()。
6. 提交事务，返回 204。

注意：
- 步骤 3、4、5 必须同一事务，避免释放标记与库存占用不一致。

### 3.5 订单过期处理

触发方式：
- 定时任务扫描 PENDING_PAYMENT 且 expires_at < now() 的订单。

单订单事务流程：
1. 锁定订单行 FOR UPDATE。
2. 再次确认该订单仍是可释放状态（未支付、未取消）。
3. 检查 released_at 是否为空；非空则说明已释放，直接跳过。
4. 更新库存占用字段：reserved_quantity -= 订单项数量。
5. 更新订单 released_at = now()；不写 cancelled_at，让状态自然呈现 EXPIRED。

说明：
- 过期释放采用“更新 released_at + 更新 reserved_quantity”的双写模式。
- 幂等主语义由 released_at 是否为空承载。

## 4. Data 层拆分建议

建议新增文件：
- services/cr7/src/data/order.ts

建议方法：
- createOrder(client, schema, input)
- getOrderById(client, schema, oid, uid)
- getOrderItemsByOrderIds(client, schema, orderIds)
- listOrdersByUser(client, schema, uid, query)
- cancelOrder(client, schema, oid, uid)
- releaseExpiredOrders(client, schema, now, batchSize)

建议新增错误码：
- ORDER_NOT_FOUND
- ORDER_STATUS_INVALID
- INVENTORY_NOT_ENOUGH
- ORDER_ALREADY_RELEASED
- SESSION_NOT_FOUND
- TICKET_CATEGORY_NOT_FOUND

## 5. Service 层拆分建议

建议新增文件：
- services/cr7/src/libs/order.ts

建议 actions：
- order.create
- order.get
- order.list
- order.cancel
- order.expire

并在 cr7.service.ts 中合并 actions：
- ...this.actions_order

API 网关路由建议：
- /orders -> cr7.order.*
- /exhibition 下的创建订单可保留在 exhibition 域路径，但 action 归属 order 领域。

## 6. SQL 迁移建议

新增迁移文件建议包含：

1) 修订库存表
- ALTER TABLE exhibit_session_inventories ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0;
- ALTER TABLE exhibit_session_inventories ADD CONSTRAINT chk_reserved_quantity_non_negative CHECK (reserved_quantity >= 0);
- ALTER TABLE exhibit_session_inventories ADD CONSTRAINT chk_reserved_quantity_lte_quantity CHECK (reserved_quantity <= quantity);

2) 修订订单表
- ALTER TABLE exhibit_orders ADD COLUMN released_at TIMESTAMPTZ;
- ALTER TABLE exhibit_orders ADD CONSTRAINT chk_exhibit_orders_release_vs_paid CHECK (released_at IS NULL OR paid_at IS NULL);
- 添加索引：CREATE INDEX idx_exhibit_orders_released_at ON exhibit_orders(released_at) WHERE released_at IS NOT NULL;

## 7. 幂等与一致性策略

- 创建订单：天然非幂等（重复提交会产生新订单），可后续引入 Idempotency-Key。
- 取消订单：幂等，靠 released_at IS NULL 条件更新 + 事务。
- 过期释放：幂等，靠 released_at IS NULL 条件更新 + 批任务可重试。
- 所有库存占用变更都通过 reserved_quantity 字段维护，quantity 永远作为上限基线值。

## 8. 与文档和类型对齐

- docs/api/order.md 中行为描述需更新：
  - “库存数量减少” 改为 “库存占用增加（reserved_quantity 增加）”。
  - “库存恢复” 改为 “库存占用释放（reserved_quantity 减少）”。
- @cr7/types 的 Order.user_id 保持 string（UUID）。

## 9. 测试建议

重点覆盖：
- 创建订单成功：reserved_quantity 正确增加。
- 超库存失败：reserved_quantity 不变。
- 取消订单：released_at 正确写入，reserved_quantity 减少。
- 取消重复请求：第二次请求幂等成功，不重复减少 reserved_quantity。
- 过期任务重复执行：released_at 仅首次写入，不重复释放。
- 多票种订单：不同 ticket_category 的占用/释放均正确。
