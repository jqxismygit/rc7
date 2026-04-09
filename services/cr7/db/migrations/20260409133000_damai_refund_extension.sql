ALTER TABLE order_refunds
DROP CONSTRAINT chk_order_refunds_method,
ADD CONSTRAINT chk_order_refunds_method CHECK (payment_method IN ('WECHATPAY', 'DAMAI',  'MOP', 'CTRIP'));
