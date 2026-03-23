# 核销相关接口

基于 `Redeem` 类型（来自 `@cr7/types`）定义。

## 概念说明

- Redemption Code（核销码）：订单支付成功后自动生成的唯一码，管理员通过该码为用户完成现场核销。
- Redemption Status（核销状态）：
  - `UNREDEEMED`：未核销
  - `REDEEMED`：已核销
- 关键字段：
  - `quantity`：准入人数，表示该核销码允许进场的人数（等于订单中所有票的总数）
  - `valid_from` 和 `valid_until`：核销码有效期（场次当天）
  - `code`：核销码字符串（12 位）
  - `redeemed_at`：核销完成时间（仅当核销成功时写入）
  - `redeemed_by`：核销人信息，记录执行核销的管理员 user_id（仅当核销成功时写入）

## 核销码生成规则

- 订单支付成功后自动生成一个核销码
- 一个已支付订单对应一个核销码
- 核销码长度固定为 12 位
- 第 1 位固定为保留字 `R`
- 中间 9 位字符集为 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`，不包含 `0`、`1`、`I`、`O`
- 最后 2 位为 Luhn 校验码，用于校验核销码合法性
- 核销码有效期为对应场次当天

## 查询订单核销信息

- URL: `/orders/:oid/redemption`
- Method: `GET`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Params:
  ```ts
  { oid: string }
  ```
- Response Body:
  ```ts
  Redeem.RedemptionCodeWithOrder
  ```
- Response Status:
  - `200 OK`：查询成功
  - `401 Unauthorized`：未认证
  - `404 Not Found`：订单不存在或无权限访问
  - `410 Gone`：订单未支付或无核销码
- 说明：
  - 仅允许查询自己订单的核销信息
  - 只有已支付订单才有核销码

## 完成核销

- URL: `/redemptions/redeem`
- Method: `POST`
- Request Header:
  ```ts
  { Authorization: `Bearer ${token}` }
  ```
- Request Body:
  ```ts
  Redeem.RedeemRequest
  ```
- Response Body:
  ```ts
  Redeem.RedemptionCode
  ```
- Response Status:
  - `200 OK`：核销成功
  - `400 Bad Request`：参数错误
  - `401 Unauthorized`：未认证或无权限
  - `404 Not Found`：核销码不存在
  - `409 Conflict`：核销码已核销或已过期
- 关键特性：
  - 核销操作幂等
  - 自动记录核销人（`redeemed_by`）和核销时间（`redeemed_at`）
  - 仅管理员/运营人员可执行核销
