# 展览活动相关接口

基于 `Exhibition` 类型（来自 `@cr7/types`）定义。

## 概念说明

- Exhibition（展览）：完整的展览活动，包含日期范围、时间和地点信息。
- Session（场次）：展览日期范围内的单日场次，默认按天自动生成。
- Ticket Category（票种）：展览可售票种配置。

## 创建展览活动

- URL: `/exhibition`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Omit<Exhibition.Exhibition, 'id' | 'created_at' | 'updated_at'>
  ```
- Response Body:
  ```ts
  Exhibition.Exhibition
  ```

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
  Omit<Exhibition.TicketCategory, 'id' | 'eid' | 'created_at' | 'updated_at'>
  ```

- Response Body:
  ```ts
  Exhibition.TicketCategory
  ```
