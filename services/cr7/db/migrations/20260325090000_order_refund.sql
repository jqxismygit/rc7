CREATE TABLE order_refunds (
  out_refund_no         VARCHAR(64) PRIMARY KEY,
  order_id              UUID NOT NULL REFERENCES exhibit_orders(id) ON DELETE CASCADE,
  payment_method        VARCHAR(32) NOT NULL,
  status                VARCHAR(20) NOT NULL,
  order_amount          INTEGER NOT NULL,
  refund_amount         INTEGER NOT NULL,
  reason                TEXT NOT NULL,
  error_message         TEXT,

  out_trade_no          VARCHAR(32) NOT NULL,
  refund_id             VARCHAR(64),
  refund_status         VARCHAR(32),
  refund_channel        VARCHAR(32),
  callback_refund_amount INTEGER,

  succeeded_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_order_refunds_method CHECK (payment_method IN ('WECHATPAY')),
  CONSTRAINT chk_order_refunds_status CHECK (status IN ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT chk_order_refunds_amount CHECK (refund_amount > 0 AND order_amount > 0 AND refund_amount <= order_amount)
);

CREATE INDEX idx_order_refunds_order_id ON order_refunds(order_id);
CREATE INDEX idx_order_refunds_status ON order_refunds(status);
CREATE INDEX idx_order_refunds_out_trade_no ON order_refunds(out_trade_no);

CREATE TABLE wechat_refund_callbacks (
  id                       UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  notification_id          VARCHAR(64) NOT NULL,
  event_type               VARCHAR(64) NOT NULL,
  out_trade_no             VARCHAR(32),
  out_refund_no            VARCHAR(64),
  refund_status            VARCHAR(32),
  raw_payload              JSONB NOT NULL,
  processed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wechat_refund_callbacks_out_trade_no ON wechat_refund_callbacks(out_trade_no) WHERE out_trade_no IS NOT NULL;
CREATE INDEX idx_wechat_refund_callbacks_out_refund_no ON wechat_refund_callbacks(out_refund_no) WHERE out_refund_no IS NOT NULL;
CREATE INDEX idx_wechat_refund_callbacks_event_type ON wechat_refund_callbacks(event_type);

ALTER TABLE exhibit_orders
ADD COLUMN current_refund_out_refund_no VARCHAR(64),
ADD COLUMN refunded_at TIMESTAMPTZ;

ALTER TABLE exhibit_orders
DROP CONSTRAINT chk_exhibit_orders_released_vs_paid,
ADD CONSTRAINT chk_exhibit_orders_released_vs_paid CHECK (
  released_at IS NULL
  OR paid_at IS NULL
  OR refunded_at IS NOT NULL
);

ALTER TABLE exhibit_orders
ADD CONSTRAINT fk_exhibit_orders_current_refund
FOREIGN KEY (current_refund_out_refund_no)
REFERENCES order_refunds(out_refund_no)
ON DELETE SET NULL;

CREATE INDEX idx_exhibit_orders_current_refund_out_refund_no
ON exhibit_orders(current_refund_out_refund_no)
WHERE current_refund_out_refund_no IS NOT NULL;

CREATE INDEX idx_exhibit_orders_refunded_at
ON exhibit_orders(refunded_at)
WHERE refunded_at IS NOT NULL;