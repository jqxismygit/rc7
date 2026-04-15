# 微信支付相关接口

基于 `Payment` 类型（来自 `@cr7/types`）定义。实现设计参见 [design/wechatpay.md](../design/wechatpay.md)。

## 发起微信支付

- URL: `POST /orders/:oid/wechatpay`
- 权限：已登录用户，且为该订单归属人
- 关键特性：
  - 订单状态必须为 `PENDING_PAYMENT`
  - 用户必须绑定微信账号（有 openid）
  - 幂等：同一订单可多次调用
- Response Body: `Payment.PaySignResult`
- 错误码：
  - `400` 订单状态不为 PENDING_PAYMENT
  - `401` 未认证
  - `404` 订单不存在或无权限
  - `409` 用户未绑定微信账号（无 openid）

## 微信支付回调

- URL: `POST /payment/wechat/callback`
- 权限：**公开接口**，无需认证；依赖微信签名验证确保来源可信
- 关键特性：
  - 所有支付回调 event 均落库（包括非 SUCCESS 事件），保障可追溯
  - 验签失败返回 `400`，通知微信重试
  - 仅处理 `TRANSACTION.SUCCESS` 且 `trade_state == SUCCESS` 的回调
  - 幂等：订单已为 `PAID` 状态时直接返回 `204`
- Response：`204 No Content`（成功）或带 `code/message` 的 JSON（失败）

## 发起微信退款

- URL: `POST /orders/:oid/refund`
- 权限：已登录用户，且为该订单归属人
- Request Body: `{ reason?: string }` — 可选退款原因，默认为 `"用户发起退款"`，透传至微信退款申请
- 关键特性：
  - 仅允许已支付订单发起退款
  - `out_refund_no` 使用系统退款记录 ID，确保唯一与幂等
  - 对接微信退款申请接口：`POST /v3/refund/domestic/refunds`
  - 退款回调地址使用独立 webhook：`/payment/wechat/callback/refund`
- Response Body: 退款受理记录（来自 `Payment.RefundRecord`）
- 错误码：
  - `400` 订单状态不允许退款
  - `401` 未认证
  - `404` 订单不存在或无权限
  - `409` 订单不满足退款策略

## 微信退款回调

- URL: `POST /payment/wechat/callback/refund`
- 权限：**公开接口**，无需认证；依赖微信签名验证确保来源可信
- 关键特性：
  - 与支付回调分离，使用独立 webhook
  - 所有退款回调 event 均落库（包括处理中、成功、关闭/异常）
  - 根据 `out_refund_no` 更新退款记录状态（`REQUESTED`/`PROCESSING`/`SUCCEEDED`/`FAILED`）
  - 幂等：相同通知重复投递不会导致重复业务状态变更
- Response：`204 No Content`（成功）或带 `code/message` 的 JSON（失败）
