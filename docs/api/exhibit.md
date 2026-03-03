# 展览活动相关接口

基于 `Exhibit` 类型（来自 `@rc7/types`）定义。

## 创建展览活动

- URL: `/exhibit`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Omit<Exhibit.Exhibition, 'id' | 'created_at' | 'updated_at'>
  ```
- Response Body:
  ```ts
  Exhibit.ExhibitionWithCategories
  ```

## 获取展览详情（含票种分类）

- URL: `/exhibit/:exhibitId`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { exhibitId: string }
  ```
- Response Body:
  ```ts
  Exhibit.ExhibitionWithCategories
  ```


## 新增票种分类

- URL: `/exhibit/:exhibitId/tickets`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { exhibitId: string }
  ```
- Request Body:
  ```ts
  Omit<Exhibit.TicketCategory, 'id' | 'exhibit_id' | 'created_at' | 'updated_at'>
  ```

- Response Body:
  ```ts
  Exhibit.TicketCategory
  ```