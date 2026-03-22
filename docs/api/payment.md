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
  - 所有回调均先落库，保障可追溯
  - 验签失败返回 `400`，通知微信重试
  - 仅处理 `TRANSACTION.SUCCESS` 且 `trade_state == SUCCESS` 的回调
  - 幂等：订单已为 `PAID` 状态时直接返回 `204`
- Response：`204 No Content`（成功）或带 `code/message` 的 JSON（失败）
