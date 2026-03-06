# Inventory API

基于 `Exhibition` 与 `Inventory` 类型（来自 `@rc7/types`）定义。

## 概念说明

- Session Inventory（场次库存）：某个场次下某个票种的库存数量。

## 获取单个场次的库存

- URL: `/exhibition/:eid/sessions/:sid/inventory`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string; sid: string }
  ```
- Response Body:
  ```ts
  Inventory.SessionInventory[]
  ```

## 批量更新某票种在所有场次的库存上限

- URL: `/exhibition/:eid/inventory/max/ticket/:tid`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string; tid: string }
  ```
- Request Body:
  ```ts
  { quantity: number }
  ```
- Response Body:
  ```ts
  { success: boolean }
  ```
