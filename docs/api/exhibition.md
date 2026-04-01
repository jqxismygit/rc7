# 展览活动相关接口

基于 `@cr7/types` 中的 `Exhibition` 命名空间定义，对应类型来源为 [exhibition](../../services/types/exhibition.ts)。

## 概念说明

- Exhibition（展览）：完整的展览活动，包含日期范围、开放时间、地点和封面图信息。
- Session（场次）：展览日期范围内按天自动生成的单日场次。
- Ticket Category（票种）：挂载在展览上的票种配置，供各个场次复用。

## 通用约定

- 所有接口都需要登录态，请求头使用 `Authorization: Bearer ${token}`。
- `GET /exhibition` 按 `created_at DESC` 排序返回。
- 创建展览后，会按 `start_date` 到 `end_date` 的自然日范围自动生成场次，起止日期均包含在内。
- 基本信息更新接口不允许修改 `start_date`、`end_date`，不会重建场次。
- 库存相关接口虽然挂在 `/exhibition/...` 路径下，但已单独整理在 [inventory.md](./inventory.md)。

## 获取展览列表

- URL: `/exhibition`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Query:
  ```ts
  {
    limit?: number;   // 默认 10，最大 100
    offset?: number;  // 默认 0
  }
  ```
- Response Body:
  ```ts
  {
    data: Exhibition.Exhibition[];
    total: number;
    limit: number;
    offset: number;
  }
  ```
- 说明：
  - 当未传分页参数时，服务端默认使用 `limit = 10`、`offset = 0`
  - 空数据时返回 `data: []`

## 创建展览活动

- URL: `/exhibition`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Exhibition.ExhibitionDraft
  ```
- Response Body:
  ```ts
  Exhibition.Exhibition
  ```
- 说明：
  - 创建成功后会自动生成对应日期范围内的所有 `Session`
  - 初始状态下不会自动创建票种，调用票种列表接口时返回空数组
  - `cover_url` 为可选字段；未传时应返回 `null`

## 管理员更新展览基本信息

- URL: `/exhibition/:eid`
- Method: `PATCH`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Request Body:
  ```ts
  Exhibition.ExhibitionPatch
  ```
- Response Body:
  ```ts
  Exhibition.Exhibition
  ```
- Response Status:
  - `200 OK`：更新成功
  - `400 Bad Request`：参数校验失败
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：无管理员权限
  - `404 Not Found`：展览不存在
- 说明：
  - 该接口用于更新展览基本信息，不修改 `start_date`、`end_date`
  - `cover_url` 允许传 `null` 清空封面图
  - 未出现在 body 中的字段保持原值不变
  - 更新时间成功后，返回最新的 `Exhibition.Exhibition`

## 获取展览详情

- URL: `/exhibition/:eid`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Body:
  ```ts
  Exhibition.Exhibition
  ```

## 获取展览场次列表

- URL: `/exhibition/:eid/sessions`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Body:
  ```ts
  Exhibition.Session[]
  ```
- 说明：
  - 返回结果按 `session_date ASC` 排序
  - 默认一日一个场次
  - 首个场次日期等于展览 `start_date`，最后一个场次日期等于展览 `end_date`

## 获取展览的票种列表

- URL: `/exhibition/:eid/tickets`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Body:
  ```ts
  Exhibition.TicketCategory[]
  ```
- 说明：
  - 返回结果按 `created_at ASC` 排序
  - 当展览下尚未配置票种时，返回空数组

## 新增票种分类

- URL: `/exhibition/:eid/tickets`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Request Body:
  ```ts
  Omit<Exhibition.TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
  ```
- Response Body:
  ```ts
  Exhibition.TicketCategory
  ```
- 说明：
  - `eid` 来自路径参数，不需要在 body 中重复传递

## 相关接口

- 场次库存与场次票种库存视图见 [inventory.md](./inventory.md)
- 基于场次创建订单见 [order.md](./order.md)
