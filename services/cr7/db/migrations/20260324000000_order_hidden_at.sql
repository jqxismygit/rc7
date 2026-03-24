ALTER TABLE exhibit_orders ADD COLUMN hidden_at TIMESTAMPTZ;

CREATE INDEX idx_exhibit_orders_hidden_at
ON exhibit_orders(hidden_at)
WHERE hidden_at IS NOT NULL;
