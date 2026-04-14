# 订单相关接口

基于 `Order` 类型（来自 [@cr7/types/order](../../services/types/order.ts)）定义。

## 概念说明

- Order（订单）：用户预订门票的订单，包含订单状态、总金额、过期时间等信息。
- Order Item（订单项）：订单中的具体票种和数量，一个订单可以包含多个订单项。
- Order Status（订单状态）：
  - `PENDING_PAYMENT`：待支付
  - `PAID`：已支付
  - `REFUND_REQUESTED`：退款已受理
  - `REFUND_PROCESSING`：退款处理中
  - `REFUNDED`：已退款
  - `REFUND_FAILED`：退款失败
  - `CANCELLED`：已取消
  - `EXPIRED`：已过期

- 库存管理：
  - `quantity`：库存上限，静态配置值，代表可售库存总数，不会因订单变化而减少
  - `reserved_quantity`：已占用库存，表示当前被待支付订单占用的数量
  - `available_quantity = quantity - reserved_quantity`：可售余量

- 关键字段：
  - `session_date`：订单对应的场次日期（`yyyy-MM-dd`），用于订单查询和展示
  - `created_at`：订单创建时间
  - `expires_at`：订单过期时间（创建后 30 分钟）
  - `cancelled_at`：订单取消时间（仅当用户主动取消时写入）
  - `paid_at`：订单支付时间（仅当订单支付成功时写入）
  - `released_at`：库存释放时间（取消或过期时写入，用于幂等控制）
  - `hidden_at`：用户隐藏时间（仅影响用户自己的订单列表，不影响管理员视图）
  - `current_refund_out_refund_no`：订单当前绑定的退款单号；没有退款流程时为 `null`
  - `source`：订单来源；用户在 CR7 站内下单为 `DIRECT`，携程回调创建的订单为 `CTRIP`

## 订单状态流转

```
PENDING_PAYMENT
    ├─ 支付成功 → PAID
    │             ├─ 发起退款 → REFUND_REQUESTED
    │             ├─ 微信处理中 → REFUND_PROCESSING
    │             ├─ 退款成功 → REFUNDED
    │             └─ 退款失败 → REFUND_FAILED
    ├─ 用户取消 → CANCELLED (released_at 已写入)
    └─ 超过 expires_at → EXPIRED (released_at 已写入)
```

说明：
- 订单状态基于 `paid_at`、`cancelled_at`、`expires_at`、`released_at` 字段计算
- 取消和过期都会写入 `released_at`，标记库存已释放，确保不重复释放

## 创建订单

- URL: `/exhibition/:eid/sessions/:sid/orders`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string; sid: string }
  ```
- Request Body:
  ```ts
  {
    items: Order.CreateOrderItem[]
  }
  ```
- Response Body:
  ```ts
  Order.OrderWithItems
  ```
- Response Status:
  - `201 Created`：订单创建成功
  - `400 Bad Request`：参数错误（订单项为空、数量不合法等）
  - `401 Unauthorized`：未认证
  - `404 Not Found`：展览或场次不存在
  - `410 Gone`：场次已过期
  - `409 Conflict`：票种库存不足，或当前用户未绑定手机号

- 说明：
  - 创建订单时会自动计算总金额并设置 30 分钟的过期时间
  - 相同票种的订单项会自动聚合
  - 订单项数量必须大于 0
  - 站内直连下单（`source = DIRECT`）要求当前用户已绑定手机号；未绑定时返回错误码 `PHONE_NOT_BOUND`，提示语为“请先绑定手机号”

## 获取订单详情

- URL: `/orders/:oid`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { oid: string }
  ```
- Response Body:
  ```ts
  Order.OrderWithItems
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `404 Not Found`：订单不存在或无权限访问

- 说明：
  - 仅允许查看自己的订单

## 获取用户的订单列表

- URL: `/orders`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Query Parameters:
  ```ts
  {
    status?: Order.OrderStatus;  // 可选，筛选特定状态的订单
    page?: number;               // 可选，页码，默认 1
    limit?: number;              // 可选，每页数量，默认 20
  }
  ```
- Response Body:
  ```ts
  Order.OrderListResult
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `400 Bad Request`：参数错误

- 说明：
  - 仅返回当前用户的订单
  - 已隐藏订单不会在用户订单列表中返回
  - 支持按订单状态筛选
  - 分页参数 `page` 和 `limit` 均可选，默认返回第 1 页，每页 20 条

## 隐藏订单

- URL: `/orders/:oid/hide`
- Method: `PATCH`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { oid: string }
  ```
- Response Status:
  - `204 No Content`：隐藏成功
  - `400 Bad Request`：订单状态不允许隐藏
  - `401 Unauthorized`：未认证
  - `404 Not Found`：订单不存在或无权限访问

- 说明：
  - 仅允许隐藏自己的订单
  - 仅非 `PENDING_PAYMENT` 状态订单可隐藏
  - 重复隐藏同一订单返回 204，幂等

## 获取管理员订单列表

- URL: `/admin/orders`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Query Parameters:
  ```ts
  {
    status?: Order.OrderStatus;
    page?: number;
    limit?: number;
  }
  ```
- Response Body:
  ```ts
  Order.OrderListResult
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `400 Bad Request`：参数错误

- 说明：
  - 仅管理员可访问
  - 返回所有订单，包含用户已隐藏的订单
  - 支持按订单状态筛选及分页

## 取消订单

- URL: `/orders/:oid`
- Method: `DELETE`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { oid: string }
  ```
- Response Status:
  - `204 No Content`：取消成功
  - `400 Bad Request`：订单状态不允许取消
  - `401 Unauthorized`：未认证
  - `404 Not Found`：订单不存在或无权限访问

- 说明：
  - 只有状态为 `PENDING_PAYMENT` 的订单可以取消
  - 重复取消同一订单返回 204，幂等
  - 仅允许取消自己的订单

## 订单过期处理

订单过期由系统定时任务自动处理，无需手动调用。

- Action: `cr7.order.expire`
- Method: 内部定时任务
- Parameters:
  ```ts
  {
    batchSize?: number;  // 单次处理的订单数量，默认 100
  }
  ```

- 说明：
  - 定时扫描所有已过期的待支付订单并释放其库存占用
  - 单次任务支持批量处理，通过 `batchSize` 参数控制
  - 幂等：重复执行不会重复释放库存

## 错误响应

所有接口在出错时返回以下格式：

```ts
{
  "code": string;      // 错误码，如 "ORDER_NOT_FOUND"
  "message": string;   // 用户可读的错误信息
}
```

常见错误码（HTTP Status Code）：
- `400 Bad Request`：参数错误（订单项为空、数量不合法等）或场次/票种不存在
- `401 Unauthorized`：未认证
- `404 Not Found`：订单不存在或无权限访问
- `409 Conflict`：库存不足
- `410 Gone`：场次已过期

## 关键特性

**幂等性**
- 取消订单：重复请求返回 204，库存只释放一次
- 过期处理：定时任务可重复执行，库存不会重复释放

**权限控制**
- 订单操作仅限于订单所有者
