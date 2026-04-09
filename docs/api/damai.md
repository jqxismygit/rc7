# 大麦 OTA 对接接口

本文档覆盖 CR7 与大麦 OTA 的对接能力，主要为管理员维护展览与场次信息同步到大麦票务平台。

基于 `@cr7/types` 中的 `Exhibition` 命名空间定义，对应类型来源为 [exhibition](../../services/types/exhibition.ts)。

## 概念说明

- OTA (Online Travel Agency)：在线旅游代理平台，本次聚焦大麦平台。
- Project（项目）：CR7 中的展览活动，在大麦侧映射为一个项目。
- Perform（场次）：展览日期范围内按天自动生成的单日场次。
- 大麦签名：涉及 API 调用时，使用 `apiKey` + `apiSecret`（或 `apiPw`） MD5 签名。

## 通用约定

- 管理端接口要求管理员权限，请求头使用 `Authorization: Bearer ${token}`。
- 场次同步支持按日期范围过滤，防止一次推送过量数据。
- 场次信息中的开放时间、闭馆时间、最后入馆时间均取自展览主记录中的对应字段。
- 所有同步接口返回 `204 No Content`，仅表示请求已提交至大麦，不表示大麦最终处理结果。
- 日期格式遵循 `yyyy-MM-dd`（仅日期部分）或 `yyyy-MM-dd HH:mm:ss`（包含时间）。

## 同步展览项目到大麦

- URL: `/exhibition/:eid/ota/damai/sync`
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
  - 仅管理员可执行该接口。
  - 同步请求携带展览基本信息（ID、名称、描述、场馆名称、封面图）到大麦 `/b2b2c/2.0/sync/project` 接口。
  - 选座功能固定为 `false`。
  - 接口本身不返回业务体，成功仅返回 `204`。

## 同步场次信息到大麦

- URL: `/exhibition/:eid/ota/damai/sync/sessions`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string }
  ```
- Request Query (可选)：
  ```ts
  {
    start_session_date?: string; // yyyy-MM-dd，含此日期
    end_session_date?: string;   // yyyy-MM-dd，含此日期
  }
  ```
- Or Request Body (可选)：
  ```ts
  {
    start_session_date?: string; // yyyy-MM-dd
    end_session_date?: string;   // yyyy-MM-dd
  }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `400 Bad Request`：参数格式错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在
- 关键特性：
  - 仅管理员可执行该接口。
  - 同步请求携带展览下符合日期范围的场次列表到大麦 `/b2b2c/2.0/sync/perform` 接口。
  - 未传日期范围参数时，同步展览的全部场次。
  - 日期范围支持：仅传 `start_session_date` 同步该日期及以后的场次，仅传 `end_session_date` 同步该日期及以前的场次，两者同时传入时同步闭区间内的场次。
  - 场次按 `session_date` 升序排列后发送。
  - 每个场次生成一个 Perform 记录，主要字段包括：
    - `id`：CR7 场次 ID
    - `performName`：格式化为 `yyyy-MM-dd`
    - `status`：固定为 `1`（有效）
    - `saleStartTime`：展览创建时间戳，格式 `yyyy-MM-dd HH:mm:ss`
    - `saleEndTime`：展览最后入馆时间 + 场次日期，格式 `yyyy-MM-dd HH:mm`
    - `showTime`：展览开放时间 + 场次日期，格式 `yyyy-MM-dd HH:mm`
    - `endTime`：展览闭馆时间 + 场次日期，格式 `yyyy-MM-dd HH:mm`
    - `tTypeAndDMethod`：固定为 `{2: [2]}`（电子票）
    - `ruleType`：固定为 `0`（无实名限制）
  - 接口本身不返回业务体，成功仅返回 `204`。

## 同步票种信息到大麦

- URL: `/exhibition/:eid/sessions/:sid/ota/damai/sync/tickets`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { eid: string, sid: string }
  ```
- Response Status:
  - `204 No Content`：同步请求发送成功
  - `400 Bad Request`：参数格式错误
  - `401 Unauthorized`：未认证
  - `403 Forbidden`：非管理员权限
  - `404 Not Found`：展览不存在或场次不存在
- 关键特性：
  - 仅管理员可执行该接口。
  - 同步请求发送到大麦 `/b2b2c/2.0/sync/price` 接口。
  - 票种信息来源于指定场次下的票种列表，按创建顺序发送。
  - 每个票种生成一个 `priceList` 项，主要字段包括：
    - `id`：CR7 票种 ID
    - `name`：CR7 票种名称
    - `price`：票种价格（单位元）
    - `saleState`：固定为 `1`（可售）
  - 接口本身不返回业务体，成功仅返回 `204`。

## 类型来源

- `Exhibition`：[types/exhibition.ts](../../services/types/exhibition.ts)
  - `Exhibition.Exhibition`：展览主体
  - `Exhibition.Session`：场次
  - `Exhibition.TicketCategory`：票种
