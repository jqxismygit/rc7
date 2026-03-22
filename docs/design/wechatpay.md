# 微信支付实现设计

微信支付文档：
- [JSAPI/小程序下单](https://pay.weixin.qq.com/doc/v3/merchant/4012791897)
- [小程序调起支付签名](https://pay.weixin.qq.com/doc/v3/merchant/4012365341)
- [支付成功回调通知](https://pay.weixin.qq.com/doc/v3/merchant/4012791902)
- [关闭订单](https://pay.weixin.qq.com/doc/v3/merchant/4012791901)

## 1. 整体流程

```
用户创建订单（PENDING_PAYMENT）
    ↓
POST /orders/:oid/wechatpay
    → 查询订单及用户 openid
    → 调用微信 JSAPI 下单（POST /v3/pay/transactions/jsapi），获取 prepay_id
    → 写入 wechat_pay_transactions
    → 用 prepay_id 签名，生成 PaySignResult 返回给小程序
    ↓
小程序调用 wx.requestPayment(PaySignResult)
    ↓
用户完成支付
    ↓
微信回调 POST /payment/wechat/callback
    → 原始通知写入 wechat_pay_callbacks（processed_at = NULL）
    → 验证回调签名（微信支付公钥）
    → 解密 resource.ciphertext（AEAD_AES_256_GCM，key 为 api_v3_secret）
    → TRANSACTION.SUCCESS + trade_state == SUCCESS：写入 paid_at，状态变 PAID
    → 更新 wechat_pay_callbacks.processed_at
    → 返回 204
```

用户取消订单时（`DELETE /orders/:oid`），若该订单存在 `wechat_pay_transaction` 记录，
则先调用微信关闭订单接口（`POST /v3/pay/transactions/out-trade-no/{out_trade_no}/close`），
再执行本地取消逻辑。

## 2. 数据模型

### wechat_pay_transactions

每次向微信 JSAPI 下单的记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | PK |
| order_id | UUID | 关联 exhibit_orders |
| out_trade_no | VARCHAR(32) | 订单 ID 去掉 `-` 后的字符串，唯一 |
| prepay_id | VARCHAR(64) | 微信返回的预支付会话标识 |
| total_amount | INTEGER | 单位：分 |
| openid | VARCHAR(128) | 支付用户的 openid |
| created_at / updated_at | TIMESTAMPTZ | |

### wechat_pay_callbacks

所有微信回调原始落库，包括非支付成功事件。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | PK |
| wechat_notification_id | VARCHAR(36) | 微信通知唯一 ID |
| event_type | VARCHAR(32) | 如 TRANSACTION.SUCCESS |
| out_trade_no | VARCHAR(32) | 可为 NULL（非交易事件） |
| transaction_id | VARCHAR(64) | 微信侧订单号 |
| trade_state | VARCHAR(32) | SUCCESS / NOTPAY / CLOSED 等 |
| raw_payload | JSONB | 完整原始通知 JSON |
| processed_at | TIMESTAMPTZ | NULL 表示尚未处理 |
| created_at | TIMESTAMPTZ | |

## 3. 发起支付实现细节

### 3.1 向微信 JSAPI 下单的关键字段

| 字段 | 取值 |
|------|------|
| appid | `config.wechatpay.appid` |
| mchid | `config.wechatpay.mchid` |
| out_trade_no | `order.id.replace(/-/g, '')` |
| description | `{展会名} {票种名} {场次日期} 场次` |
| amount.total | `order.total_amount`（单位：分） |
| payer.openid | 用户 openid（来自 user_wechat 表） |
| time_expire | `order.created_at + 30min`，格式 `yyyy-MM-DDTHH:mm:ss+08:00` |
| notify_url | `config.wechatpay.callback_url` |

### 3.2 请求签名

使用 `buildWechatPayAuthorization()`（已在 `src/libs/wepay.ts` 实现），
以商户私钥（`config.wechatpay.client_cert_path`）+ 证书序列号（`config.wechatpay.client_cert_serial_no`）
生成 `WECHATPAY2-SHA256-RSA2048` Authorization 头。

### 3.3 生成 PaySignResult

获得 prepay_id 后，调用 `signPay(prepay_id, { appid, privateKey, ... })`（已在 `src/libs/wepay.ts` 实现），
返回 `PaySignResult`（含 timeStamp、nonceStr、package、signType、paySign）。

## 4. 回调处理实现细节

### 4.1 验签

使用请求头 `Wechatpay-Timestamp`、`Wechatpay-Nonce`、`Wechatpay-Signature`、`Wechatpay-Serial`
与请求体，结合微信支付公钥（`config.wechatpay.wechat_pay_public_key_path`）验证签名。

验签串格式：
```
{Wechatpay-Timestamp}\n
{Wechatpay-Nonce}\n
{请求体原文}\n
```

### 4.2 解密 resource.ciphertext

算法：AEAD_AES_256_GCM
Key：`config.wechatpay.api_v3_secret`（32字节 UTF-8）
Nonce：`resource.nonce`
AAD：`resource.associated_data`
密文末尾 16 字节为 GCM AuthTag。

### 4.3 幂等保障

- 若 `wechat_pay_callbacks` 已存在相同 `wechat_notification_id` 的记录，直接返回 `204`，不重复处理。
- 若对应订单 `paid_at IS NOT NULL`，跳过状态更新，直接返回 `204`。
