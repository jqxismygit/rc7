ALTER TABLE order_refunds
ALTER COLUMN out_trade_no TYPE VARCHAR(64);

ALTER TABLE order_refunds
DROP CONSTRAINT chk_order_refunds_method,
ADD CONSTRAINT chk_order_refunds_method CHECK (payment_method IN ('WECHATPAY', 'DAMAI',  'MOP', 'CTRIP'));
