## 通用协议

- 请求头使用 `supplier`、`timestamp`、`version`、`sign`
- 请求体使用 `encryptData`，业务明文经 AES 加密后传输
- 签名规则：
  - 请求签名：`supplier + timestamp + version + URI`
  - 响应签名：`code + timestamp`
- 响应结构统一包含 `code`、`msg`、`timestamp`、`sign`、`encryptData`
- 详细协议见 [docs/ota/mop.md](docs/ota/mop.md)

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
  - Request Body:
  ```ts
  {
    sessionDateStart?: string; // yyyy-MM-dd
    sessionDateEnd?: string;   // yyyy-MM-dd
  }
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
- Request Body:
  ```ts
  {
    sessionDateStart?: string; // yyyy-MM-dd
    sessionDateEnd?: string;   // yyyy-MM-dd
  }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口
  - 同步请求会推送到 MOP `sku/push` 接口
  - 支持按场次日期范围筛选同步：`sessionDateStart` 到 `sessionDateEnd`（闭区间）
  - 每个推送 sku 都包含对应场次 ID（`otShowId`）
  - `otSkuId` 使用 CR7 票种 ID，`name` 使用 CR7 票种名称
  - `otSkuStatus` 固定为有效（`1`）
  - `skuPrice` 与 `sellPrice` 都由 CR7 票价（分）转换为元字符串
  - `onSaleTime` 使用展会开售日期与开始时间组合，`offSaleTime` 使用展会结束日期与结束时间组合
  - `inventoryType` 固定为共享库存（`1`）
  - OTA 票档类型固定为 `isOta = 1`
  - 接口本身不返回业务体，成功仅返回 `204`

## 同步库存信息到 MOP

- URL: `/exhibition/:eid/ota/mop/sync/stocks`
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
  {
    sessionDateStart?: string; // yyyy-MM-dd
    sessionDateEnd?: string;   // yyyy-MM-dd
  }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `400 Bad Request`：场次日期范围非法（`MOP_SESSION_DATE_RANGE_INVALID`）
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口
  - 同步请求会推送到 MOP `stock/push` 接口
  - 支持按场次日期范围筛选同步：`sessionDateStart` 到 `sessionDateEnd`（闭区间）
  - `otShowId` 使用 CR7 场次 ID，`otSkuId` 使用 CR7 票种 ID
  - `inventoryType` 固定为共享库存（`1`）
  - `stock` 取自对应场次下票种的当前可售库存数量
  - 接口本身不返回业务体，成功仅返回 `204`

## 同步票种日历库存价格到 MOP

- URL: `/exhibition/:eid/tickets/:tid/ota/mop/sync/calendar`
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
    sessionDateStart?: string; // yyyy-MM-dd
    sessionDateEnd?: string;   // yyyy-MM-dd
  }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `400 Bad Request`：场次日期范围非法（`MOP_SESSION_DATE_RANGE_INVALID`）
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览或票种不存在
- 关键特性：
  - 以展会票种为核心，按场次日期范围（闭区间）同步到猫眼
  - 单次调用顺序推送三类消息：场次（`show/push`）→ 票种（`sku/push`）→ 库存（`stock/push`）
  - 场次消息仅包含指定日期范围内的场次；票种与库存仅包含指定 `tid` 对应票种
  - 场次状态/类型/取票方式、票种 OTA 类型与库存模式沿用现有 MOP 同步规则
  - 接口本身不返回业务体，成功仅返回 `204`

## 创建订单回调（猫眼调用 CR7）

- 状态：文档已补充，服务端实现进行中
- URL: `/ota/mop/order`
- Method: `POST`
- 鉴权与安全：
  - 按 MOP 协议校验请求签名
  - 对 `encryptData` 解密后读取业务字段
  - 响应按 MOP 协议加签并加密
- 业务请求字段（解密后）：
  - `myOrderId`：猫眼订单 ID
  - `projectCode`：CR7 展会 ID
  - `projectShowCode`：CR7 场次 ID
  - `buyerName`、`buyerPhone`：购买人信息
  - `needSeat`、`needRealName`：选座/实名标记
  - `ticketInfo[]`：订单项，核心字段为 `myTicketId`、`skuId`、`ticketPrice`
- 业务响应字段（加密后）：
  - `myOrderId`：回传猫眼订单 ID
  - `channelOrderId`：CR7 订单 ID
  - `payExpiredTime`：CR7 订单支付过期时间戳（毫秒）
- 业务约束：
  - `projectCode`、`projectShowCode`、`skuId` 必须能映射到 CR7 有效资源
  - `ticketInfo` 中票种与金额需要与 CR7 当前可售信息一致
  - 下单成功后会创建/复用用户并创建来源为 OTA 的待支付订单
  - 订单创建失败时，返回 MOP 业务错误码（如库存不足、参数异常）

## 查看单个 CR7 订单的猫眼同步记录

- URL: `/ota/mop/orders/:rid`
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
  Mop.MopOrderSyncRecord[]
  ```
- 关键特性：
  - 仅管理员可访问。
  - 返回记录按 `created_at DESC` 排序，第一条为最新同步记录。
  - 每条记录包含 `request_path`、解密后的 `request_body`、同步状态与关联 `order_id`。
  - 请求刚解密成功时即落盘，同步完成后更新 `response_body`、`sync_status` 与 `order_id`。

## 类型来源

- 路径参数中的 `eid` 对应展览主键，展览类型定义见 `services/types/exhibition.ts` 中 `Exhibition.Exhibition`。
- 场次同步数据来源于 `services/types/exhibition.ts` 中 `Exhibition.Session` 与 `Exhibition.Exhibition` 的时间字段组合。
- 票种同步数据来源于 `services/types/exhibition.ts` 中 `Exhibition.TicketCategory` 与 `Exhibition.Exhibition` 的时间字段组合。
- 创建订单回调中的订单与用户类型来源于 `services/types/order.ts`、`services/types/user.ts`、`services/types/exhibition.ts`。
- 猫眼同步记录查询类型来源于 `services/types/mop.ts` 中 `Mop.MopOrderSyncRecord`。

## 相关文档

- MOP 平台协议说明见 `docs/ota/mop.md`