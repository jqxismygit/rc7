# Redemption Code 核销码设计文档

本文档描述核销码的整体设计方案。

## 1. 目标与边界

### 1.1 目标

- 支持订单支付后自动生成唯一的核销码
- 支持用户查询自己订单的核销信息
- 支持管理员通过扫码完成用户核销操作
- 确保核销操作的幂等性和数据一致性
- 支持核销码有效期管理
- 核销操作必须在展会上下文中进行，验证核销码属于该展会

### 1.2 非目标

- 不实现分次核销（预留字段便于后续扩展）
- 不实现退票相关的核销码作废逻辑（单独设计）

## 2. 核销码生命周期

### 2.1 状态流转

```
订单支付成功
    ↓
生成核销码（初始状态: UNREDEEMED）
    ↓
UNREDEEMED
  ├─ 管理员/运营完成核销 → REDEEMED (redeemed_at 已写入)
    └─ 超过有效期 → 过期（业务层判断，状态不变）
```

### 2.2 生命周期说明

- 核销码在订单支付成功时自动生成
- 核销码有效期为对应场次的当天有效
- 核销需要检查以下条件：
  - 核销码当前状态为 UNREDEEMED
  - 当前时间在 valid_from 和 valid_until 范围内
  - 执行核销的用户具有管理员/运营权限
  - 核销人数 <= 核销码的准入人数
- 核销成功后记录 redeemed_at 时间戳和 redeemed_by（核销人 user_id），状态更新为 REDEEMED

## 3. 数据模型

### 3.1 核销码表（exhibit_redemption_codes）

```sql
CREATE TABLE exhibit_redemption_codes (
  id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  order_id              UUID NOT NULL UNIQUE REFERENCES exhibit_orders(id) ON DELETE CASCADE,
  exhibit_id            UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  code                  VARCHAR(12) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'UNREDEEMED',

  quantity              INTEGER NOT NULL,
  valid_from            TIMESTAMPTZ NOT NULL,
  valid_until           TIMESTAMPTZ NOT NULL,
  redeemed_at           TIMESTAMPTZ,
  redeemed_by           UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_redemption_code_status CHECK (status IN ('UNREDEEMED', 'REDEEMED')),
  CONSTRAINT chk_redemption_code_quantity CHECK (quantity > 0),
  CONSTRAINT chk_redemption_code_redeemed_vs_status
    CHECK ((status = 'REDEEMED' AND redeemed_at IS NOT NULL AND redeemed_by IS NOT NULL) OR (status = 'UNREDEEMED' AND redeemed_at IS NULL AND redeemed_by IS NULL)),
  CONSTRAINT chk_redemption_code_valid_period CHECK (valid_until > valid_from)
);

CREATE UNIQUE INDEX idx_redemption_code_exhibit_code ON exhibit_redemption_codes(exhibit_id, code);
CREATE INDEX idx_redemption_code_order_id ON exhibit_redemption_codes(order_id);
CREATE INDEX idx_redemption_code_exhibit_id ON exhibit_redemption_codes(exhibit_id);
CREATE INDEX idx_redemption_code_status ON exhibit_redemption_codes(status);
CREATE INDEX idx_redemption_code_valid_period ON exhibit_redemption_codes(valid_from, valid_until)
  WHERE status = 'UNREDEEMED';
```

### 3.2 字段说明

- `id`：核销码唯一标识
- `exhibit_id`：展会 ID，核销码关联的展会
- `order_id`：关联的订单，一对一关系
- `code`：核销码字符串（展会内唯一，可扫码），格式为 12 位：`R` + 9 位业务字符 + 2 位 Luhn 校验码
- `status`：核销状态，UNREDEEMED 或 REDEEMED
- `quantity`：准入人数（等于订单购买的总票数）
- `valid_from`：有效期起始时间（通常为场次当天 00:00:00）
- `valid_until`：有效期截止时间（通常为场次当天 23:59:59）
- `redeemed_at`：核销完成时间（仅当 status = REDEEMED 时有值）
- `redeemed_by`：核销人 user_id，记录执行核销操作的用户（仅当 status = REDEEMED 时有值）

## 4. 核心流程

### 4.1 核销码生成流程

**触发条件**：订单支付成功

**流程**：
1. 在 exhibit_orders 表中找到 id = order_id 的记录
2. 获取订单关联的 session 信息，计算当天的 valid_from 和 valid_until
3. 计算订单的总购票数（sum of order_items.quantity）
4. 生成唯一的 code（12 位）：
  - 第 1 位固定为 `R`
  - 中间 9 位使用字符集 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
  - 最后 2 位由前 10 位按 Luhn 算法计算得到校验码
5. 插入 exhibit_redemption_codes 表

**关键特性**：
- 生成操作幂等：相同 order_id 的重复生成请求返回相同 code
- code 生成使用去歧义字符集并带 Luhn 校验码，降低人工录入/扫码误读风险

### 4.2 核销流程

**请求参数**：
- code：核销码
- quantity（可选）：本次核销的人数，默认为整个 quantity

**流程**：
1. 验证当前用户具有管理员/运营权限
2. 根据 code 查询 exhibit_redemption_codes 表
3. 验证核销码属于指定的展会（exhibit_id 必须与请求参数中的 eid 相匹配）
4. 检查以下条件：
   - 核销码存在
   - status = 'UNREDEEMED'
   - NOW() 在 valid_from 和 valid_until 范围内
   - quantity > 0（或 quantity <= redemption_code.quantity 如果支持分次核销）
5. 更新表：
   - SET status = 'REDEEMED', redeemed_at = NOW(), redeemed_by = current_user_id
   - WHERE id = redemption_code_id AND status = 'UNREDEEMED'
6. 验证更新影响行数 >= 1，否则意味着并发冲突或状态已变

**关键特性**：
- 使用乐观锁或 WHERE 条件保证并发安全
- 核销操作幂等：重复核销相同 code 返回成功（已核销状态）

### 4.3 查询流程

**查询用户核销码列表**：
- 根据当前用户 id 和订单的 user_id 关联查询
- 支持按 status 筛选
- 支持分页

**查询订单核销信息**：
- 根据 order_id 查询核销码
- 需要权限验证（只能看自己的订单）

**查询核销码详情**（管理端）：
- 根据 code 直接查询
- 需要管理员权限

## 5. 业务约束

### 5.1 有效期计算

核销码的有效期基于对应的场次日期：
- `valid_from` = 场次日期的 00:00:00（使用场次所在地时区）
- `valid_until` = 场次日期的 23:59:59（使用场次所在地时区）

### 5.2 code 生成规则

- 长度固定为 12 位
- 第 1 位固定为 `R`（保留字）
- 中间 9 位字符集为 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
- 最后 2 位为 Luhn 校验码，校验失败的 code 不可核销
- 需保证同一展会内唯一，冲突时重新生成

### 5.3 权限控制

- 用户只能查看自己订单的核销码
- 管理员/运营可以查看任意核销码并完成核销
- 核销操作（POST /exhibition/:eid/redemptions/redeem）需要身份认证

### 5.4 错误处理

- 核销码不存在：404 Not Found
- 核销码已核销：409 Conflict
- 核销码已过期：409 Conflict
- 无权限访问：401 Unauthorized 或 404 Not Found（隐藏）

## 6. 后续扩展考虑

### 6.1 分次核销

预留 `redeemed_quantity` 字段，支持分次核销：
- 一个核销码可以分多次核销
- 每次核销时指定人数，累计 redeemed_quantity
- 核销完成条件：redeemed_quantity >= quantity

### 6.2 核销码作废

订单退票时需要作废对应的核销码：
- 新增状态：CANCELLED
- 记录 cancelled_at 时间戳
- 防止已核销的核销码作废

### 6.3 核销记录审计

新增表 exhibit_redemption_records 记录每次核销操作：
- redemption_code_id
- redeemed_quantity
- redeemed_by（管理员 id）
- redeemed_at
- created_at
