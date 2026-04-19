# Inventory API

基于 `Exhibition` 与 `Inventory` 类型（来自 `@cr7/types`）定义。

## 概念说明

- Session Inventory（场次库存）：某个场次下某个票种的库存数量。

## 获取单个场次的所有票种和库存

- URL: `/exhibition/:eid/sessions/:sid/tickets`
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
  Inventory.SessionTicketPrice[]
  ```

## 批量更新某票种在所有场次的库存上限

- URL: `/exhibition/:eid/sessions/tickets/:tid/inventory/max`
- Method: `PUT`
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
  {
    quantity: number;
    start_session_date?: string; // yyyy-MM-dd
    end_session_date?: string;   // yyyy-MM-dd
  }
  ```
- Response status:
  - `204 No Content`
  - `400 Bad Request`：仅传一个日期、日期区间非法或参数不合法
- 说明：
  - 不传 `start_session_date` / `end_session_date`：保持原行为，覆盖更新该票种在展览所有场次的库存上限
  - 同时传 `start_session_date` 与 `end_session_date`：按闭区间对该票种场次库存做增量更新

## 查询票种在指定日期范围的场次库存价格列表

- URL: `/exhibition/:eid/tickets/:tid/calendar`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Query:
  ```ts
  { start_session_date: string; end_session_date: string } // yyyy-MM-dd, 闭区间
  ```
- Response Body:
  ```ts
  Inventory.TicketCalendarInventory[]
  ```
## 设置票种在指定日期范围的场次价格

- URL: `/exhibition/:eid/tickets/:tid/calendar/price`
- Method: `PUT`
- 权限：仅管理员
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
  {
    price: number;            // 场次价格（分），最小值 0
    start_session_date: string; // yyyy-MM-dd，闭区间起始
    end_session_date: string;   // yyyy-MM-dd，闭区间结束
  }
  ```
- Response status:
  - `204 No Content`
  - `400 Bad Request`：参数不合法或日期区间非法
  - `404 Not Found`：展览或票种不存在
- 关键特性：
  - 按闭区间对指定票种在各场次设置独立价格
  - 可通过 `GET /:eid/tickets/:tid/calendar` 查看各场次实际生效价格

