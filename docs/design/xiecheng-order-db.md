# 携程订单同步数据库设计

本文档只描述携程订单场景涉及的数据库变更。价格、库存同步日志沿用现有 `exhibit_xc_sync_logs`。

## 1. 设计目标

- 为每次可成功解密的 `CreatePreOrder` 请求保留同步快照，包含成功、重复和业务失败场景。
- 把订单主状态继续放在订单领域表中，不让 `xiecheng` data layer 接管订单、用户、库存主数据。
- 为后台聚合查询和幂等判定提供稳定索引。

## 2. 携程订单同步记录表

### 2.1 新表 `xc_order_sync_records`

```sql
CREATE TABLE cr7.xc_order_sync_records (
  id                     UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  service_name           VARCHAR(64) NOT NULL,
  ota_order_id           VARCHAR(128),
  sequence_id            VARCHAR(128) NOT NULL,
  request_header         JSONB NOT NULL,
  request_body           JSONB NOT NULL,
  response_body          JSONB NOT NULL,
  phone                  VARCHAR(32),
  country_code           VARCHAR(16),
  total_amount           INTEGER,
  sync_status            VARCHAR(32) NOT NULL,
  user_id                UUID REFERENCES cr7.users(id) ON DELETE SET NULL,
  order_id               UUID REFERENCES cr7.exhibit_orders(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_xc_order_sync_records_service_name
    CHECK (service_name = 'CreatePreOrder'),
  CONSTRAINT chk_xc_order_sync_records_sync_status
    CHECK (sync_status IN ('SUCCESS', 'DUPLICATE_ORDER', 'FAILED')),
  CONSTRAINT chk_xc_order_sync_records_sequence_id_not_blank
    CHECK (LENGTH(BTRIM(sequence_id)) > 0),
  CONSTRAINT chk_xc_order_sync_records_ota_order_id_not_blank
    CHECK (ota_order_id IS NULL OR LENGTH(BTRIM(ota_order_id)) > 0),
  CONSTRAINT chk_xc_order_sync_records_phone_not_blank
    CHECK (phone IS NULL OR LENGTH(BTRIM(phone)) > 0),
  CONSTRAINT chk_xc_order_sync_records_country_code_not_blank
    CHECK (country_code IS NULL OR LENGTH(BTRIM(country_code)) > 0)
);
```

### 2.2 索引设计

```sql
CREATE UNIQUE INDEX uq_xc_order_sync_records_sequence_id
  ON cr7.xc_order_sync_records(sequence_id);

CREATE INDEX idx_xc_order_sync_records_ota_order_id_created_at
  ON cr7.xc_order_sync_records(ota_order_id, created_at DESC);

CREATE INDEX idx_xc_order_sync_records_phone_country_code_created_at
  ON cr7.xc_order_sync_records(country_code, phone, created_at DESC);

CREATE INDEX idx_xc_order_sync_records_sync_status_created_at
  ON cr7.xc_order_sync_records(sync_status, created_at DESC);

CREATE INDEX idx_xc_order_sync_records_order_id
  ON cr7.xc_order_sync_records(order_id);

CREATE INDEX idx_xc_order_sync_records_user_id
  ON cr7.xc_order_sync_records(user_id);
```

设计理由：

- `sequence_id` 唯一，保证每次携程通知只落一条同步记录。
- `ota_order_id` 不唯一，因为同一订单允许被重复通知多次。
- `order_id` 由 `xiecheng.service` 先确定 candidate 值，并在订单创建或复用后写入同步记录；重试时复用同一个 `order_id`，用于保证订单创建幂等。
- 手机号与国别码组合索引支撑后台按购买人筛选，并用于测试校验“只创建一个账号”。
- `sync_status` 索引支撑后台按失败类型快速排查。

## 3. 字段语义

### 3.1 请求快照

- `request_header`：保存收到的 header 原文。
- 不保存原始密文 body。
- `request_body`：保存解密后的明文对象，便于后台核对携程原始业务参数与本地处理结果。

### 3.2 业务快照

- `total_amount`：本次创建订单时计算出的订单总价，单位为分。
- `user_id`：关联到已创建或已复用的用户；业务失败时允许为空。
- `order_id`：由 `xiecheng.service` 先确定 candidate 值，再在订单创建或复用后写入记录；同一 `otaOrderId` 的重复请求复用同一个 `order_id`。

### 3.3 响应快照

- `response_body`：保存最终返回给携程的响应对象，便于后台核对携程原始业务参数、CR7 处理结果与最终返回结果的一致性。

## 4. Data Layer 边界

`xiecheng` data layer 只负责以下内容：

- 插入、更新、查询 `xc_order_sync_records`。
- 插入、查询既有 `exhibit_xc_sync_logs`。

明确不负责：

- 创建或更新 `users`。
- 创建或更新 `exhibit_orders`、`exhibit_order_items`。
- 扣减或释放库存。

这些动作必须由 service 层通过 `ctx.call(...)` 交给 user、order、exhibition 等领域完成。

## 5. 查询模型建议

单条记录接口 `GET /ota/ctrip/orders/:rid` 建议以 `xc_order_sync_records` 为主表，再按需补齐聚合字段：

- 同步记录主字段直接从 `xc_order_sync_records` 读取。
- 订单状态、总价可从 `exhibit_orders` 读取。
- 对同一 `ota_order_id` 的重复通知，记录中的 `order_id` 必须保持一致。

## 6. 迁移顺序建议

建议拆成一个携程领域 migration：

1. 创建 `xc_order_sync_records` 表及相关索引。
2. 增加 `sync_status` 的约束值（`SUCCESS`、`DUPLICATE_ORDER`、`FAILED`）。

这样可以保持职责边界清晰，且不把 OTA 来源耦合进订单通用模型。

## 7. 测试与清理注意事项

- 测试清理不通过 SQL 直接删除这些表的数据。
- 若需要清理场景数据，应在 spec 中通过 broker 直接调用各领域现有 action，按关联关系做最小清理。
- 同步记录保留 `order_id`、`user_id` 的外键，是为了让清理逻辑可以按引用关系有序执行，而不是反向要求测试直查数据库。