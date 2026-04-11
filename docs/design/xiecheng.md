# 携程 OTA 对接设计文档

本文档覆盖两个阶段的携程能力：

- 管理员维护票种与携程价格、库存同步。
- 携程按 CreatePreOrder 协议通知 CR7 创建订单，并提供后台排障与测试校验能力。

数据库结构单独见 [xiecheng-order-db.md](./xiecheng-order-db.md)。

## 1. 目标与边界

### 1.1 目标

- 支持管理员在票种上绑定携程 OTA Option ID。
- 支持管理员把票种场次价格同步到携程 `DatePriceModify`。
- 支持管理员把票种场次库存同步到携程 `DateInventoryModify`。
- 支持携程通过 `CreatePreOrder` 回调创建 CR7 用户和订单。
- 提供可通过 API 校验的管理端读取能力，覆盖 feature 中的全部断言。

### 1.2 边界

- `xiecheng` data layer 只负责携程同步与订单通知快照数据。
- 用户、订单、库存、票种映射等主业务数据均通过 `ctx.call(...)` 调用对应领域 action 处理，不允许由 `xiecheng` data layer 直接写入这些表。
- 测试中的断言不允许直查数据库，必须走公开 API。
- 订单同步记录只保留可成功解密的请求。

### 1.3 非目标

- 本次不实现 `PayPreOrder`、`CancelPreOrder`、退款、核销等其他携程订单接口。
- 不实现多 OTA 平台统一抽象层。
- 不为测试暴露专用清理 HTTP API。

## 2. 外部接口范围

### 2.1 管理端同步接口

- `PUT /exhibition/:eid/tickets/:tid/ota/xc`
- `POST /exhibition/:eid/tickets/:tid/ota/xc/sync/prices`
- `POST /exhibition/:eid/tickets/:tid/ota/xc/sync/inventory`
- `GET /exhibition/:eid/tickets/:tid/ota/xc/sync/logs`

这些接口维持现有职责，只处理票种与携程商品的配置和场次同步。

### 2.2 携程订单回调接口

- `POST /ota/ctrip/callback`

该地址配置给携程开放平台的 `CreatePreOrder`。CR7 作为供应商接口实现方接收请求并返回携程标准报文。

### 2.3 管理端校验接口

- `GET /ota/ctrip/orders/:rid`

该接口是订单 feature 的校验入口。当前实现返回 `Xiecheng.XcOrderSyncRecord[]`，用于校验请求快照、关联订单与总价信息；若传入的是 `otaOrderId`，则返回该外部订单全部同步记录并按时间倒序排列。

## 3. 同步接口设计

### 3.1 绑定 OTA Option ID

管理员在票种上设置 `ota_option_id`，存储于 `exhibit_ticket_categories.ota_xc_option_id`。该字段只用于价格、库存同步到携程商品。CreatePreOrder 订单场景中的票种识别不走 `ota_xc_option_id`，而是直接使用携程请求里的 `PLU = CR7 ticket id`。

### 3.2 场次价格同步

价格同步由管理员传入 `start_session_date` 与 `end_session_date`。服务端按天展开场次，并把票种 `price` 从分转换为携程要求的金额格式。

约束：

- 日期区间必须落在展览 `start_date ~ end_date` 范围内。
- 结束日期距离今天不能超过 210 天。
- 单次调用需要遵守携程的单次条数和频率限制，必要时按批发送。

### 3.3 场次库存同步

库存同步和价格同步共享相同的日期约束。若未传 `quantity`，则通过 `ctx.call('cr7.exhibition.listSessionInventoryByTicketAndDateRange', ...)` 读取各场次剩余库存；若传入 `quantity`，则以该值覆盖，但不能超过剩余库存。

### 3.4 同步日志

价格和库存同步继续使用 `exhibit_xc_sync_logs` 记录：

- 快照语义：记录同步时使用的 `ota_option_id`、同步项和携程返回。
- 失败可追踪：网络异常和携程业务异常都保留原始响应摘要。
- 无业务编排：日志表不承载订单、用户、库存主状态。

## 4. CreatePreOrder 订单处理方案

### 4.1 处理原则

- 以 `otaOrderId` 作为 CR7 侧的外部订单幂等键。
- 以 `sequenceId` 作为单次通知流水号，完整记录每次请求。
- 成功解密后先确定 `order_id`，再调用订单领域创建订单；同一个 `otaOrderId` 的重试必须复用同一 `order_id`。
- 对重复订单必须返回首次成功的业务结果，不重复创建用户和订单。
- 同一 `otaOrderId` 的多条同步记录必须保持同一个 `order_id`，用于保证订单创建幂等。
- 解密失败请求直接返回标准错误响应，不写订单同步记录。

### 4.2 请求处理流程

```
携程 POST /ota/ctrip/callback
    ↓ 校验 accountId / serviceName / sign
    ↓ 尝试 AES 解密 body
    ↓ 若解密失败，构造标准失败响应并结束（不写同步记录）
    ↓ 根据 otaOrderId 查找已存在同步记录，若存在则复用其中的 order_id
    ↓ 若不存在则先生成 candidate order_id，并在本次处理上下文中保留
    ↓ 根据 plu（即 CR7 ticket id）通过 exhibition 领域解析票种与场次
    ↓ 根据手机号、国别码通过 user 领域查找或创建用户
    ↓ 根据 otaOrderId 通过 order 领域查找是否已存在关联订单
    ↓ 若已存在，标记同步记录为 DUPLICATE_ORDER，并返回幂等成功响应
    ↓ 若不存在，调用 order 领域创建订单，并显式传入预先确定的 order_id
    ↓ 在订单创建或复用后写入/更新订单同步记录中的 user_id / order_id / 同步状态
    ↓ 返回携程成功响应
```

### 4.3 领域调用边界

订单场景下 `xiecheng.service` 只做协议转换、编排和同步记录写入，主业务必须下沉到既有领域 action：

- 票种映射：通过 exhibition 领域 action 完成，如“按 ticket id 读取票种，并校验该 id 是否可用于当前携程订单项”。
- 用户创建或复用：通过 user 领域 action 完成，如“按手机号查找或创建用户”。
- 订单创建或查询：通过 order 领域 action 完成，如“按携程订单号查询已关联订单”“创建订单并关联携程订单号”。
- `order.create` 需要支持上游显式传入 `id`，让 `xiecheng.service` 可以复用预分配的 `order_id` 实现幂等。
- 后台校验查询：当前直接返回同步记录视图；如后续需要扩展聚合字段，再通过 order 和 user 领域补齐读取模型。

这样可以保证：

- `xiecheng` data layer 不感知订单和用户的表结构。
- 订单状态、库存占用、用户幂等仍由对应领域统一控制。
- 后续接入其他 OTA 时不会把订单逻辑复制到多个 data layer。

## 5. 携程响应构造器

### 5.1 设计要求

CreatePreOrder 的返回需要统一由共享 helper 构造，不在 action 中拼散落对象。建议提供形如 `buildXiechengOrderResponse(...)` 的方法，职责如下：

- 根据 `resultCode` 和 `resultMessage` 生成 `header`。
- 成功时把业务 body 先序列化、再 AES 加密后写入响应 `body`。
- 失败时按携程规范决定是否返回业务 `body`；解密失败场景可以不返回 `body`。
- 对同一 `otaOrderId` 的重复请求复用首次成功生成的 `supplierOrderId` 和业务 body。

### 5.2 返回码映射

优先使用携程标准错误码：

- `0000`：创建成功，或重复通知幂等成功。
- `0001`：报文解析失败。
- `0002`：签名错误。
- `0003`：供应商账户信息不正确。
- `1001`：找不到 `PLU` 对应票种。
- `1003`：库存不足。
- `1009`：日期不合法。

只有标准码无法表达时，才使用 `1100-1199` 自定义业务错误，并在 `resultMessage` 中写明真实原因。

## 6. 后台读取模型

`GET /ota/ctrip/orders/:rid` 当前返回 `Xiecheng.XcOrderSyncRecord[]`，其中每条记录覆盖以下信息：

- 本次请求的 `ota_order_id`、`sequence_id`、`sync_status`。
- 手机号、国别码。
- 关联的 `user_id`、`order_id`。
- 订单总价快照 `total_amount`。
- 原始 `request_header` 与解密后的 `request_body`。

这样 feature 中“账号只创建一次”“订单只创建一次”“后台可检查同步记录内容”等断言都可以仅通过 API 完成。

说明：

- `rid` 既可以是同步记录主键 `id`，也可以是 `otaOrderId`。
- 两种入参都返回同一个 `otaOrderId` 下的同步记录列表。
- 列表按 `created_at DESC` 排序，首条是最新同步记录。
- `response_body` 当前仅保存在数据库中，不通过该接口返回。

## 7. 测试策略

### 7.1 数据校验

- 所有断言必须通过公开 API 完成。
- 不允许在 spec 中通过 `pool.query(...)` 或 data 层 helper 直接读取数据库。
- 优先复用 `GET /ota/ctrip/orders/:rid` 作为校验入口，减少测试里拼装多个读取路径。

### 7.2 场景清理

每个 scenario 执行结束后，必须清理本次场景创建的数据，避免手机号、外部订单号和 sequence ID 冲突。

约束：

- 清理逻辑通过 `broker.call(...)` 调内部 action 完成。
- 不暴露对外 HTTP API。
- 不允许测试直接执行 SQL 删除数据。
- 不封装 `xiecheng.test.cleanupScenarioData` 这类聚合清理 action；直接在 spec 中按依赖顺序调用各领域已有 action 进行最小清理。

### 7.3 Step 复用

`vitest-cucumber` 同一 scenario 内不能定义两段文本完全相同的 step。遇到重复断言时：

- 优先在 spec 中复用同一个 step implementation。
- 如果文案必须区分前置与断言，则只调整自然语言，不复制同样的逻辑实现。
- 复用共通 helper，不要在多个 scenario 内各写一份用户、订单、记录校验代码。

## 8. 关键特性

- 幂等：同一 `otaOrderId` 只创建一个 CR7 订单；重复请求只新增同步记录。
- 幂等：同一 `otaOrderId` 复用同一个预分配 `order_id`，避免订单创建阶段因重试生成多个订单。
- 协议隔离：携程 AES/签名/返回码规则收敛在 `xiecheng` 领域，避免污染订单领域。
- 领域边界清晰：用户、订单、库存的状态机仍由对应领域维护。
- API 可验证：测试与后台排障都通过 API，而不是数据库直查。
- 失败可追踪：重复订单和业务失败保留快照记录；解密失败按协议直接返回错误。
