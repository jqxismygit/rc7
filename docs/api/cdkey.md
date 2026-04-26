# 兑换码相关接口

基于 `Cdkey` 类型（来自 [@cr7/types](../../services/types/cdkey.ts)）定义。

## 管理员创建兑换码批次

- URL: `/cdkeys/batches`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  {
    eid: string;
    name: string;
    ticket_category_id: string;
    redeem_quantity: number;
    quantity: number;
    redeem_valid_until: string; // yyyy-MM-dd
  }
  ```
- Response Body:
  ```ts
  Cdkey.CreateCdkeyBatchResult
  ```
- Response Status:
  - `201 Created`：创建成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员

## 管理员分页查询兑换码批次

- URL: `/cdkeys/batches`
- Method: `GET`
- Query Parameters:
  ```ts
  { eid: string; page?: number; limit?: number }
  ```
- Response Body:
  ```ts
  Cdkey.CdkeyBatchListResult
  ```

## 管理员分页查询批次下兑换码

- URL: `/cdkeys/batches/:bid/codes`
- Method: `GET`
- Request Params:
  ```ts
  { bid: string }
  ```
- Query Parameters:
  ```ts
  { page?: number; limit?: number }
  ```
- Response Body:
  ```ts
  Cdkey.CdkeyListResult
  ```

## 管理员查询单个兑换码详情

- URL: `/cdkeys/:code`
- Method: `GET`
- Request Params:
  ```ts
  { code: string }
  ```
- Response Body:
  ```ts
  Cdkey.Cdkey
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员
  - `404 Not Found`：兑换码不存在

## 用户使用兑换码兑换核销码

- URL: `/cdkeys/sessions/:sid/redeem`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  {
    code: string;
  }
  ```
- Response Body:
  ```ts
  Redeem.RedemptionCode
  ```
- Response Status:
  - `200 OK`：兑换成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证
  - `404 Not Found`：兑换码或场次不存在
  - `409 Conflict`：兑换码已使用
  - `410 Gone`：兑换码已过期
