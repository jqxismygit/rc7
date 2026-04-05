# 猫眼 MOP 对接接口

本文档描述管理端触发猫眼 MOP 同步的接口。

## 同步展览项目到 MOP

- URL: `/exhibition/:eid/ota/mop/sync`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `400 Bad Request`：参数错误或展览城市暂不支持同步（`MOP_CITY_NOT_SUPPORTED`）
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口
  - 当前仅支持上海展览同步（城市映射为 `310000` / `上海市`）
  - 同步请求会读取本地 MOP 密钥配置并按 MOP 协议签名后提交
  - 接口本身不返回业务体，成功仅返回 `204`

## 同步场次信息到 MOP

- URL: `/exhibition/:eid/ota/mop/sync/sessions`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口
  - 同步请求基于展会场次列表推送到 MOP `show/push` 接口
  - 每个场次的 `otShowId` 使用 CR7 场次 ID
  - 场次状态固定为有效（`otShowStatus = 1`）
  - 场次类型固定为单场票（`showType = 1`）
  - 取票方式固定为电子检票码（`fetchTicketWay = [2]`）
  - 每笔订单最大购买份数固定为 `6`
  - 接口本身不返回业务体，成功仅返回 `204`

## 同步票种信息到 MOP

- URL: `/exhibition/:eid/ota/mop/sync/tickets`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口
  - 同步请求会推送到 MOP `sku/push` 接口
  - `otSkuId` 使用 CR7 票种 ID，`name` 使用 CR7 票种名称
  - `otSkuStatus` 固定为有效（`1`）
  - `skuPrice` 与 `sellPrice` 都由 CR7 票价（分）转换为元字符串
  - `onSaleTime` 使用展会开售日期与开始时间组合，`offSaleTime` 使用展会结束日期与结束时间组合
  - `inventoryType` 固定为共享库存（`1`）
  - OTA 票档类型固定为 `isOta = 1`
  - 接口本身不返回业务体，成功仅返回 `204`

## 类型来源

- 路径参数中的 `eid` 对应展览主键，展览类型定义见 `services/types/exhibition.ts` 中 `Exhibition.Exhibition`。
- 场次同步数据来源于 `services/types/exhibition.ts` 中 `Exhibition.Session` 与 `Exhibition.Exhibition` 的时间字段组合。
- 票种同步数据来源于 `services/types/exhibition.ts` 中 `Exhibition.TicketCategory` 与 `Exhibition.Exhibition` 的时间字段组合。

## 相关文档

- MOP 平台协议说明见 `docs/ota/mop.md`