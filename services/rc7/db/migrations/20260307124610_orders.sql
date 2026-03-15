-- Create base orders table (status 由时间戳计算)
CREATE TABLE exhibit_orders (
	id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	user_id               INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
	exhibit_id            UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
	session_id            UUID NOT NULL REFERENCES exhibit_sessions(id) ON DELETE CASCADE,
	total_amount          INTEGER NOT NULL,

	expires_at            TIMESTAMPTZ NOT NULL,
	paid_at               TIMESTAMPTZ,
	cancelled_at          TIMESTAMPTZ,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT chk_exhibit_orders_total_amount CHECK (total_amount >= 0),
	CONSTRAINT chk_exhibit_orders_timestamps CHECK (
		(paid_at IS NULL OR cancelled_at IS NULL)  -- 不能同时支付和取消
	)
);

-- Create view with computed status field
CREATE VIEW exhibit_orders_with_status AS
SELECT
	id,
	user_id,
	exhibit_id,
	session_id,
	CASE
		WHEN paid_at IS NOT NULL THEN 'PAID'
		WHEN cancelled_at IS NOT NULL THEN 'CANCELLED'
		WHEN expires_at < NOW() THEN 'EXPIRED'
		ELSE 'PENDING_PAYMENT'
	END AS status,
	total_amount,
	expires_at,
	paid_at,
	cancelled_at,
	created_at,
	updated_at
FROM exhibit_orders;

-- Create order items table
CREATE TABLE exhibit_order_items (
	id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	order_id              UUID NOT NULL REFERENCES exhibit_orders(id) ON DELETE CASCADE,
	ticket_category_id    UUID NOT NULL REFERENCES exhibit_ticket_categories(id) ON DELETE CASCADE,
	quantity              INTEGER NOT NULL,
	unit_price            INTEGER NOT NULL,
	subtotal              INTEGER NOT NULL,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT chk_exhibit_order_items_quantity CHECK (quantity > 0),
	CONSTRAINT chk_exhibit_order_items_unit_price CHECK (unit_price >= 0),
	CONSTRAINT chk_exhibit_order_items_subtotal CHECK (subtotal >= 0),
	CONSTRAINT chk_exhibit_order_items_subtotal_calc CHECK (subtotal = quantity * unit_price)
);

-- Create indexes for efficient queries
CREATE INDEX idx_exhibit_orders_user_id ON exhibit_orders(user_id);
CREATE INDEX idx_exhibit_orders_exhibit_id ON exhibit_orders(exhibit_id);
CREATE INDEX idx_exhibit_orders_session_id ON exhibit_orders(session_id);
-- 基于时间戳字段的索引，用于状态查询
CREATE INDEX idx_exhibit_orders_paid_at ON exhibit_orders(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX idx_exhibit_orders_cancelled_at ON exhibit_orders(cancelled_at) WHERE cancelled_at IS NOT NULL;
CREATE INDEX idx_exhibit_orders_expires_at ON exhibit_orders(expires_at) WHERE paid_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX idx_exhibit_order_items_order_id ON exhibit_order_items(order_id);
CREATE INDEX idx_exhibit_order_items_ticket_category_id ON exhibit_order_items(ticket_category_id);

