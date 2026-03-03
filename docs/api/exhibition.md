# 展览活动相关接口

基于 `Exhibit` 类型（来自 `@rc7/types`）定义。

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
  Exhibition.ExhibitionWithCategories
  ```

## 获取展览详情（含票种分类）

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
  Exhibition.ExhibitionWithCategories
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