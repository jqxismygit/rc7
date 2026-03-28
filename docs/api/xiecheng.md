# 携程 OTA 对接接口

基于 `Exhibition.TicketCategory` 与 `Xiecheng.XcSyncLog` 类型（来自 `@cr7/types`）。

## 概念说明

- **OTA (Online Travel Agency)**：在线旅游代理平台，如携程 (Ctrip)。
- **ota_xc_option_id**：携程侧的票种标识符，由携程分配，用于关联我方票种与携程产品选项。
- **DatePriceModify**：携程用于接收场次日期与价格信息的服务名称。
- **DateInventoryModify**：携程用于接收场次库存信息的服务名称。
- **supplier_option_id**：我方票种 ID，随同步请求传递给携程，供携程后台做对账关联。

## 通用约定

- 所有接口均要求管理员权限，请求头使用 `Authorization: Bearer ${token}`。
- 价格单位为分（整数）。
- 同步数据经 AES 加密及 HMAC 签名后发送至携程，详见 [设计文档](../design/xiecheng.md)。

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
  - 设置票种的携程 OTA Option ID，后续同步时使用此 ID 关联携程平台的对应产品选项
  - 若已有 `ota_xc_option_id`，覆盖更新
  - `tid` 对应的票种必须属于 `eid` 指定的展览，否则返回 `404`

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
  - 票种必须已绑定携程编号（`ota_xc_option_id` 非空），否则返回 `409 Conflict`
  - `start_session_date` 与 `end_session_date` 为必填，表示本次同步的场次日期区间（含起止日期）
  - 同步区间必须落在展览 `start_date` 到 `end_date` 范围内，否则返回 `400 Bad Request`
  - 受携程限制，单次同步最多支持到距离今天 210 天
  - 售价与成本价均取票种当前 `price` 字段
  - 同步数据经加密后发送至携程 DatePriceModify 接口
  - 无论携程接口成功与否，均写入一条同步日志并返回

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
    quantity?: number;          // 可选，指定每个场次同步库存
  }
  ```
- Response Body:
  ```ts
  Xiecheng.XcSyncLog
  ```
- 说明：
  - 票种必须已绑定携程编号（`ota_xc_option_id` 非空），否则返回 `409 Conflict`
  - `start_session_date` 与 `end_session_date` 为必填，表示本次同步的场次日期区间（含起止日期）
  - 同步区间必须落在展览 `start_date` 到 `end_date` 范围内，否则返回 `400 Bad Request`
  - 未传 `quantity` 时，默认同步各场次当前剩余库存
  - 传入 `quantity` 时，按指定数量同步到区间内每个场次（需为正整数）
  - 受携程限制，单次同步最多支持到距离今天 210 天
  - 同步数据经加密后发送至携程 DateInventoryModify 接口
  - 无论携程接口成功与否，均写入一条同步日志并返回

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
  - 返回结果按 `created_at DESC` 排序
  - 不传 `service_name` 时返回票种的全部携程同步记录
  - 传 `service_name = DatePriceModify` 时，仅返回价格同步记录
  - 传 `service_name = DateInventoryModify` 时，仅返回库存同步记录
  - 无同步记录时返回空数组

## 状态码约定

| 状态码 | 含义 |
|--------|------|
| `200`  | 操作成功 |
| `401`  | 未认证 |
| `403`  | 非管理员权限 |
| `400`  | 日期参数非法或不在展览场次范围内 |
| `404`  | 展览或票种不存在，或票种不属于该展览 |
| `409`  | 票种未绑定携程编号，无法执行同步 |

## 相关文档

- 设计与加密方案见 [design/xiecheng.md](../design/xiecheng.md)
- 票种管理接口见 [exhibition.md](./exhibition.md)
