# 携程 OTA 对接接口

本文档覆盖两类能力：

- 管理员维护票种与携程 OTA 的价格、库存同步。
- 携程按 CreatePreOrder 协议回调 CR7 创建订单，以及管理员通过 API 校验同步结果。

管理端同步接口基于 `Exhibition.TicketCategory` 与 `Xiecheng.XcSyncLog` 类型（来自 `@cr7/types`）。订单回调与管理端校验接口使用 `Xiecheng` 命名空间下的订单类型（同样来自 `@cr7/types`），并遵循 [CreatePreOrder](https://open.trip.com/apiplatform/order.jsp#operation/CreatePreOrder) 与携程返回码规范。

## 概念说明

- OTA (Online Travel Agency)：在线旅游代理平台，如携程。
- `ota_xc_option_id`：携程侧票种标识，用于把 CR7 票种映射到携程商品选项。
- `DatePriceModify`：携程价格同步服务名。
- `DateInventoryModify`：携程库存同步服务名。
- `CreatePreOrder`：携程订单预下单创建接口。本次订单场景按该协议处理。
- `supplier_option_id`：CR7 票种 ID，随价格/库存同步报文发给携程。
- `PLU`：携程订单中的产品标识。在本项目中直接使用 CR7 票种 ID，不使用 `ota_xc_option_id`。
- `otaOrderId`：携程订单号。对 CR7 来说，它是外部订单号和幂等主键。
- `sequenceId`：携程本次请求的批次流水号。每次通知都不同，需原样记录。

## 通用约定

- 管理端接口要求管理员权限，请求头使用 `Authorization: Bearer ${token}`。
- 携程回调接口不使用 Bearer Token，而是校验 `header.accountId`、`header.serviceName`、`header.sign`。
- 价格单位在 CR7 内部为分，返回给携程的业务金额字段按携程协议输出。
- 携程请求和响应都使用 `POST` JSON 报文；业务 `body` 节点按 AES-128-CBC 加密，签名规则使用 `MD5(accountId + serviceName + requestTime + body + version + signKey)`。
- 订单场景中的测试断言必须通过公开 API 完成，不能直接查询数据库。为此需要使用下文的“管理员查看携程订单记录”接口。

## 绑定票种携程编号

- URL: `/exhibition/:eid/tickets/:tid/ota/xc`
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
  { ota_option_id: string }
  ```
- Response Body:
  ```ts
  Exhibition.TicketCategory
  ```
- 说明：
  - 设置票种的携程 OTA Option ID，仅用于价格与库存同步。
  - 若已有 `ota_xc_option_id`，覆盖更新。
  - `tid` 对应的票种必须属于 `eid` 指定的展览，否则返回 `404`。

## 同步票种场次价格至携程

- URL: `/exhibition/:eid/tickets/:tid/ota/xc/sync`
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
  {
    start_session_date: string; // yyyy-MM-dd
    end_session_date: string;   // yyyy-MM-dd
  }
  ```
- Response Body:
  ```ts
  Xiecheng.XcSyncLog
  ```
- 说明：
  - 票种必须已绑定携程编号，否则返回 `409 Conflict`。
  - 同步区间必须落在展览 `start_date` 到 `end_date` 范围内，否则返回 `400 Bad Request`。
  - 单次同步最远只能到距离今天 210 天。
  - 售价与成本价均取票种当前 `price` 字段。
  - 无论携程接口成功与否，均写入一条同步日志并返回。

## 同步票种场次库存至携程

- URL: `/exhibition/:eid/tickets/:tid/ota/xc/sync/inventory`
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
  {
    start_session_date: string; // yyyy-MM-dd
    end_session_date: string;   // yyyy-MM-dd
    quantity?: number;
  }
  ```
- Response Body:
  ```ts
  Xiecheng.XcSyncLog
  ```
- 说明：
  - 票种必须已绑定携程编号，否则返回 `409 Conflict`。
  - 未传 `quantity` 时，默认同步各场次当前剩余库存。
  - 传入 `quantity` 时，按指定数量同步到区间内每个场次，且不能超过剩余库存。
  - 无论携程接口成功与否，均写入一条同步日志并返回。

## 查看票种携程同步记录

- URL: `/exhibition/:eid/tickets/:tid/ota/xc/sync/logs`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  {
    eid: string;
    tid: string;
    service_name?: 'DatePriceModify' | 'DateInventoryModify';
  }
  ```
- Response Body:
  ```ts
  Xiecheng.XcSyncLog[]
  ```
- 说明：
  - 返回结果按 `created_at DESC` 排序。
  - 不传 `service_name` 时返回票种全部携程同步记录。
  - 无同步记录时返回空数组。

## 接收携程 CreatePreOrder 订单通知

- URL: `/ota/ctrip/callback`
- Method: `POST`
- Request Body:
  ```ts
  Xiecheng.XcEncryptedOrderNotification
  ```
- Decrypted Request Body:
  ```ts
  Xiecheng.XcCreatePreOrderBody
  ```
- Response Body:
  ```ts
  Xiecheng.XcEncryptedOrderResponse
  ```
- Decrypted Success Body:
  ```ts
  Xiecheng.XcCreatePreOrderSuccessBody
  ```
- 说明：
  - 该地址配置给携程 CreatePreOrder 供应商接口。
  - HTTP 状态码固定返回 `200 OK`，业务成功或失败通过 `header.resultCode` 表达。
  - 请求验签失败时返回携程标准错误码 `0002`。
  - 请求体无法解密或 JSON 解析失败时返回 `0001`。
  - 成功解密后，CR7 会先生成或复用一个确定的 `order_id`，再把该 `order_id` 传给订单领域创建逻辑，以保证重试时幂等复用同一订单。
  - 找不到 `PLU` 对应票种时优先返回携程标准错误码 `1001`。
  - 库存不足时优先返回携程标准错误码 `1003`。
  - 场次日期非法时优先返回携程标准错误码 `1009`。
  - 当 `otaOrderId` 已在 CR7 创建成功时，必须按携程幂等要求直接返回成功，并复用首次创建得到的 `supplierOrderId`。
  - 成功时 CR7 会通过领域服务创建或复用用户、创建或复用订单。

## 查看单个 CR7 订单的携程同步记录

- URL: `/ota/ctrip/orders/:rid`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { rid: string }
  ```
- Response Body:
  ```ts
  Xiecheng.XcOrderSyncRecord[]
  ```
- 说明：
  - 列表按 `created_at DESC` 排序，第一条即最新同步记录。
  - 若记录不存在，返回 `404`。

## 查看携程订单同步记录列表

- URL: `/ota/ctrip/orders`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Query:
  ```ts
  {
    limit?: number;      // 默认 10，范围 1-100
    offset?: number;     // 默认 0
    ota_order_id?: string;
  }
  ```
- Response Body:
  ```ts
  {
    data: Xiecheng.XcOrderSyncRecord[];
    total: number;
    limit: number;
    offset: number;
  }
  ```
- 说明：
  - 同步记录只保留可成功解密的请求；解密失败请求不会生成可查询记录。
  - `ota_order_id` 可用于筛选某个携程订单号的所有同步记录。
  - 列表按 `created_at DESC` 排序，第一条即最新同步记录。
  - 当携程对同一 `otaOrderId` 重复通知时，最新同步记录中的 `order_id` 必须与首条成功记录保持一致，不能生成新的 CR7 订单。
  - 同步记录在数据库中会保存请求快照与响应快照；管理端查询返回的记录项为 `Xiecheng.XcOrderSyncRecord`，用于排障所需的请求头、解密后的请求体、订单关联信息与总价快照，不返回 `response_body`。

## 携程返回码约定

| `resultCode` | 含义 | 场景 |
|---|---|---|
| `0000` | 操作成功 | 订单创建成功或重复请求幂等成功 |
| `0001` | 报文解析失败 | AES 解密失败、JSON 结构错误 |
| `0002` | 签名错误 | `sign` 校验失败 |
| `0003` | 供应商账户信息不正确 | `accountId` 不匹配 |
| `1001` | 产品 PLU 不存在/错误 | 找不到 `PLU` 对应票种 |
| `1003` | 库存不足 | 无法创建订单 |
| `1009` | 日期错误 | `useStartDate/useEndDate` 不在展览可售范围内，或两者不是同一天 |
| `1100-1199` | 自定义业务错误 | 非标准失败原因，`resultMessage` 必须写明真实原因 |

## 类型定义位置

- 携程同步类型：`services/types/xiecheng.ts` 中 `Xiecheng.XcSyncLog`、`Xiecheng.XcSyncItem` 等。
- 携程订单回调与记录类型：`services/types/xiecheng.ts` 中 `Xiecheng.XcEncryptedOrderNotification`、`Xiecheng.XcCreatePreOrderBody`、`Xiecheng.XcOrderSyncRecord` 等。

## 管理端 HTTP 状态码约定

| 状态码 | 含义 |
|---|---|
| `200` | 查询或操作成功 |
| `400` | 日期参数、分页参数或过滤参数非法 |
| `401` | 未认证 |
| `403` | 非管理员权限 |
| `404` | 展览、票种或订单记录不存在 |
| `409` | 票种未绑定携程编号，无法执行同步 |

## 相关文档

- 设计方案见 [design/xiecheng.md](../design/xiecheng.md)
- 数据库设计见 [design/xiecheng-order-db.md](../design/xiecheng-order-db.md)
- 票种管理接口见 [exhibition.md](./exhibition.md)
