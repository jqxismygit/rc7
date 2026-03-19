# 订单相关接口

基于 `Order` 类型（来自 `@cr7/types`）定义。

## 概念说明

- Order（订单）：用户预订门票的订单，包含订单状态、总金额、过期时间等信息。
- Order Item（订单项）：订单中的具体票种和数量，一个订单可以包含多个订单项。
- Order Status（订单状态）：
  - `PENDING_PAYMENT`：待支付
  - `PAID`：已支付
  - `CANCELLED`：已取消
  - `EXPIRED`：已过期
  - 状态由 data 层查询订单时基于 `paid_at`、`cancelled_at`、`expires_at` 动态计算

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
  // CreateOrderItem = { ticket_category_id: string; quantity: number }
  ```
- Response Body:
  ```ts
  Order.OrderWithItems
  ```
- 说明：
  - 创建订单时会自动计算总金额并设置 30 分钟的过期时间
  - 创建订单时会锁定对应的库存，`reserved_quantity` 增加
  - 如果库存不足，返回 400 错误

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
  {
    orders: Order.OrderWithItems[];
    total: number;
    page: number;
    limit: number;
  }
  ```

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
- Response status: `204 No Content`
- 说明：
  - 只有状态为 `PENDING_PAYMENT` 的订单可以取消
  - 取消订单时会释放锁定的库存，`reserved_quantity` 减少
  - 如果订单已支付或已取消，返回 400 错误

## 订单支付（待实现）

- URL: `/orders/:oid/pay`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { oid: string }
  ```
- Request Body:
  ```ts
  {
    payment_method: string;  // 支付方式
    payment_data: any;       // 支付相关数据
  }
  ```
- Response Body:
  ```ts
  Order.Order
  ```
- 说明：
  - 支付成功后订单状态变为 `PAID`
  - 此接口需要与支付服务集成，待后续实现

## 订单过期处理

订单过期由系统定时任务自动处理：
- 定时扫描所有 `PENDING_PAYMENT` 状态且已过期的订单
- 释放锁定的库存，`reserved_quantity` 减少
