ALTER TABLE exhibit_orders
  ADD COLUMN session_half VARCHAR(2);

ALTER TABLE exhibit_orders
  ADD CONSTRAINT chk_exhibit_orders_session_half
  CHECK (session_half IS NULL OR session_half IN ('AM', 'PM'));