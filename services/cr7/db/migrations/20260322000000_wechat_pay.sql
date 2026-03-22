-- 微信支付交易记录：对应每次向微信 JSAPI 下单的记录
CREATE TABLE wechat_pay_transactions (
	id                       UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	order_id                 UUID NOT NULL REFERENCES exhibit_orders(id) ON DELETE CASCADE,
	-- order_id 去掉 - 后的字符串，作为微信侧的商户订单号
	out_trade_no             VARCHAR(32) NOT NULL UNIQUE,
	-- 微信返回的预支付会话标识，下单成功后写入
	prepay_id                VARCHAR(64),
	total_amount             INTEGER NOT NULL,
	openid                   VARCHAR(128) NOT NULL,

	created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT chk_wechat_pay_transactions_amount CHECK (total_amount > 0)
);

CREATE INDEX idx_wechat_pay_transactions_order_id ON wechat_pay_transactions(order_id);

-- 微信支付回调落库：所有微信回调事件原始记录，确保可追溯
CREATE TABLE wechat_pay_callbacks (
	id                       UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	-- 微信通知唯一 ID
	wechat_notification_id   VARCHAR(36) NOT NULL,
	event_type               VARCHAR(32) NOT NULL,
	out_trade_no             VARCHAR(32),
	transaction_id           VARCHAR(64),
	trade_state              VARCHAR(32),
	-- 完整原始通知 JSON
	raw_payload              JSONB NOT NULL,
	-- 业务处理完成时间，NULL 表示尚未处理
	processed_at             TIMESTAMPTZ,

	created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wechat_pay_callbacks_out_trade_no ON wechat_pay_callbacks(out_trade_no) WHERE out_trade_no IS NOT NULL;
CREATE INDEX idx_wechat_pay_callbacks_event_type ON wechat_pay_callbacks(event_type);
