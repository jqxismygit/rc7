ALTER TABLE exhibit_session_inventories
ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE exhibit_session_inventories
ADD CONSTRAINT chk_session_inventory_reserved_non_negative
CHECK (reserved_quantity >= 0);

ALTER TABLE exhibit_session_inventories
ADD CONSTRAINT chk_session_inventory_reserved_lte_quantity
CHECK (reserved_quantity <= quantity);

ALTER TABLE exhibit_orders
ADD COLUMN released_at TIMESTAMPTZ;

ALTER TABLE exhibit_orders
ADD CONSTRAINT chk_exhibit_orders_released_vs_paid
CHECK (released_at IS NULL OR paid_at IS NULL);

CREATE INDEX idx_exhibit_orders_released_at
ON exhibit_orders(released_at)
WHERE released_at IS NOT NULL;

DROP VIEW IF EXISTS exhibit_orders_with_status;
