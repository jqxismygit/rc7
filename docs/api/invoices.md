# 发票相关接口

基于 `Invoice` 类型（来自 [@cr7/types/invoice](../../services/types/invoice.ts)）定义。

## 申请订单发票

- URL: `/orders/:oid/invoice`
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
    invoice_title: string;
    tax_no?: string;
    email: string;
  }
  ```
- Response Body:
  ```ts
  Invoice.InvoiceRecord
  ```
- Response Status:
  - `200 OK`：申请成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限（管理员能力场景）
  - `404 Not Found`：订单不存在或无权限访问
  - `409 Conflict`：订单状态不是已支付，无法申请发票
  - `502 Bad Gateway`：第三方开票平台错误

- 说明：
  - 仅允许对自己的订单申请发票
  - 管理员也复用本接口，可为任意订单申请发票
  - 仅 `PAID` 状态订单可申请
  - 系统会同步调用发票平台开具发票，并保存申请记录

## 查看单个订单发票记录

- URL: `/orders/:oid/invoice`
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
  Invoice.InvoiceRecord
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：既不是管理员也不是订单创建者
  - `404 Not Found`：订单发票记录不存在

- 说明：
  - 管理员或订单创建者可访问
  - 返回该订单最近一条发票申请记录，便于确认开票状态

## 查询发票申请列表

- URL: `/orders/invoice`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Query Parameters:
  ```ts
  {
    oid?: string;
  }
  ```
- Response Body:
  ```ts
  Invoice.InvoiceListResult
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证

- 说明：
  - 仅返回当前登录用户的发票申请记录
  - 支持传 `oid` 仅查看指定订单的发票申请记录
