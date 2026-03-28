# 携程 OTA 对接设计文档

## 1. 目标与边界

### 1.1 目标

- 支持管理员在票种上绑定携程 OTA Option ID。
- 支持管理员将票种的场次日期和价格信息同步至携程 DatePriceModify 接口。
- 支持管理员将票种的场次库存信息同步至携程 DateInventoryModify 接口。
- 记录每次同步操作的结果，包含 sequence ID、场次范围、价格或库存及同步状态，供管理员查阅。

### 1.2 非目标

- 不实现携程订单回调或退款联动。
- 不实现多 OTA 平台统一抽象层（当前仅携程）。
- 不实现自动定时同步，仅支持手动触发。

---

## 2. 携程集成方案

### 2.1 绑定 OTA Option ID

管理员在票种上设置携程分配的 `ota_option_id`（存储在 `exhibit_ticket_categories.ota_xc_option_id`）。同步时此 ID 作为 `otaOptionId` 传给携程，用于标识携程侧对应的产品选项。

### 2.2 场次价格同步（DatePriceModify）

携程价格单位是元，服务端价格单位为分，需转换后同步。
同步接口由管理员传入 `start_session_date` 与 `end_session_date`，服务端在该区间内按天生成场次价格记录（含起止日期）。每条记录包含：
因为携程价格同步接口有如下限制：
```text
价格同步接口，支持商家更新资源的价格，每次调用最多接收90条的价格数据，最远同步距离当日210天的价格数据，接口调用频率要小于100次/分钟，同一资源更新频率小于5次/分钟; 适用于景点/玩乐品类产品资源的价格同步。
```
因此服务端需要对请求日期区间做约束校验，确保单次同步日期的结束时间距离今天不超过 210 天，并在必要时进行分批调用（每次不超过 90 条）。

| 携程字段 | 来源 |
|---|---|
| `otaOptionId` | 票种 `ota_xc_option_id` |
| `supplierOptionId` | 票种 `id` |
| `date` | 场次日期（yyyy-MM-dd） |
| `salePrice` | 票种 `price`（元） |
| `costPrice` | 票种 `price`（元，成本价等于售价） |
| `serviceName` | 固定值 `"DatePriceModify"` |

### 2.3 场次库存同步（DateInventoryModify）

库存同步接口同样由管理员传入 `start_session_date` 与 `end_session_date`，可选传入 `quantity`。服务端在该区间内按天生成库存记录（含起止日期）：

- 未传 `quantity` 时：默认使用各场次当前剩余库存进行同步。
- 传入 `quantity` 时：按指定数量同步到区间内每个场次。

日期区间约束与价格同步一致：

- 同步区间需落在展览 `start_date ~ end_date` 范围内。
- 结束日期距离今天不超过 210 天。

| 携程字段 | 来源 |
|---|---|
| `otaOptionId` | 票种 `ota_xc_option_id` |
| `supplierOptionId` | 票种 `id` |
| `date` | 场次日期（yyyy-MM-dd） |
| `quantity` | 请求体 `quantity`（有值时）或场次剩余库存（默认） |
| `serviceName` | 固定值 `"DateInventoryModify"` |

### 2.4 加密与签名

携程 OTA 接口要求对请求体进行 AES 加密，并附带 HMAC-SHA256 签名，以保证传输安全与来源验证。

流程：

```
原始 JSON payload
    ↓ AES-CBC 加密（密钥从携程后台配置获取）
加密后的 ciphertext（Base64）
    ↓ HMAC-SHA256 签名（使用签名密钥）
最终请求体 { data: ciphertext, sign: signature }
```

- AES 密钥与 HMAC 密钥在 config 中配置，不硬编码于代码中。
- 携程接收端使用同一套密钥对请求体解密并校验签名。

---

## 3. 数据模型

### 3.1 `exhibit_ticket_categories` 新增字段

在现有票种表上新增携程 OTA Option ID 字段：

```sql
ALTER TABLE exhibit_ticket_categories
  ADD COLUMN ota_xc_option_id VARCHAR(255);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `ota_xc_option_id` | `VARCHAR(255)` NULL | 携程 OTA Option ID，未绑定时为 NULL |

### 3.2 `exhibit_xc_sync_logs` 同步记录表（新建）

记录每次向携程发起 DatePriceModify 或 DateInventoryModify 同步操作的完整信息：

```sql
CREATE TABLE exhibit_xc_sync_logs (
  sequence_id           UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  ticket_category_id    UUID NOT NULL REFERENCES exhibit_ticket_categories(id) ON DELETE CASCADE,
  service_name          VARCHAR(64) NOT NULL,
  ota_option_id         VARCHAR(255) NOT NULL,
  sync_items            JSONB NOT NULL,
  sync_response         JSONB,
  status                VARCHAR(20) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xc_sync_logs_ticket_category_id
  ON exhibit_xc_sync_logs(ticket_category_id);
CREATE INDEX idx_xc_sync_logs_created_at
  ON exhibit_xc_sync_logs(created_at DESC);
```

#### 字段说明

| 字段 | 说明 |
|---|---|
| `ticket_category_id` | 关联的票种 ID |
| `sequence_id` | 携程返回或本次请求生成的全局唯一序列号 |
| `service_name` | 携程服务名：`DatePriceModify`, `DateInventoryModify` |
| `ota_option_id` | 本次同步使用的携程 Option ID（快照，防止后续修改影响历史记录） |
| `status` | 同步结果：`SUCCESS` \| `FAILURE` |
| `sync_items` | 本次同步的数据快照, 价格同步存价格，库存同步存库存 |
| `sync_response` | 携程返回的响应信息（JSONB） |

> `ota_option_id`、`sync_items`、`sync_response` 均为快照字段，记录本次同步时实际使用的值，与票种后续修改解耦。

---

## 4. 核心流程

### 4.1 绑定携程编号

```
管理员 PUT /exhibition/:eid/tickets/:tid/ota/xc
    ↓ 验证票种属于该展览
    ↓ 更新 exhibit_ticket_categories.ota_xc_option_id
    ↓ 返回更新后的 TicketCategory
```

### 4.2 同步场次价格

```
管理员 POST /exhibition/:eid/tickets/:tid/ota/xc/sync
    ↓ 检查票种已绑定 ota_xc_option_id（否则 409）
    ↓ 校验请求参数 start_session_date / end_session_date
    ↓ 校验日期区间在展览 start_date ~ end_date 内（否则 400）
    ↓ 校验结束日期距离今天不超过 210 天（否则 400）
    ↓ 生成区间内场次日期列表
    ↓ 组装 DatePriceModify payload（每日一条）
    ↓ AES 加密 + HMAC 签名
    ↓ 调用携程 DatePriceModify 接口
    ↓ 写入 exhibit_xc_sync_logs（SUCCESS 或 FAILURE）
    ↓ 返回同步日志记录
```

### 4.3 同步场次库存

```
管理员 POST /exhibition/:eid/tickets/:tid/ota/xc/sync/inventory
    ↓ 检查票种已绑定 ota_xc_option_id（否则 409）
    ↓ 校验请求参数 start_session_date / end_session_date / quantity(optional)
    ↓ 校验日期区间在展览 start_date ~ end_date 内（否则 400）
    ↓ 校验结束日期距离今天不超过 210 天（否则 400）
    ↓ 生成区间内场次日期列表
    ↓ 未传 quantity 时按场次剩余库存组装 payload
    ↓ 传 quantity 时按指定数量组装 payload（每日一条）
    ↓ AES 加密 + HMAC 签名
    ↓ 调用携程 DateInventoryModify 接口
    ↓ 写入 exhibit_xc_sync_logs（SUCCESS 或 FAILURE）
    ↓ 返回同步日志记录
```

### 4.4 查询同步记录

```
管理员 GET /exhibition/:eid/tickets/:tid/ota/xc/sync/logs
    ↓ 按 ticket_category_id 查 exhibit_xc_sync_logs
    ↓ 可选按 query.service_name 过滤（DatePriceModify / DateInventoryModify）
    ↓ 按 created_at DESC 排序返回
```

---

## 5. 关键特性

- **快照语义**：同步日志中的 `ota_option_id`、`sync_items`、`sync_response` 均为同步时的快照，后续票种修改不影响历史记录。
- **幂等写日志**：每次调用同步接口均写入一条新日志（包含 `SUCCESS` 和 `FAILURE`），不覆盖历史，便于追踪每次同步尝试。
- **加密密钥隔离**：AES 密钥与 HMAC 密钥通过环境变量注入，不存储在数据库中。
- **前提校验**：同步前强制检查票种已绑定 `ota_xc_option_id`，防止携程侧因缺少 Option ID 导致静默失败。
- **区间可控同步**：通过 `start_session_date` / `end_session_date` 精确控制本次同步范围，支持按业务需要分段同步。
- **统一日志模型**：价格与库存同步共用 `exhibit_xc_sync_logs`，通过 `service_name` 区分同步类型，便于追踪和查询。
- **库存同步策略**：库存同步支持“默认按场次剩余库存”与“按指定数量同步”两种模式。
