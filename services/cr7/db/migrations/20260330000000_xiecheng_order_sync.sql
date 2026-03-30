-- Xiecheng order sync records table
CREATE TABLE xc_order_sync_records (
  id                     UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  service_name           VARCHAR(64) NOT NULL,
  ota_order_id           VARCHAR(128) NOT NULL,
  sequence_id            VARCHAR(128) NOT NULL,
  request_header         JSONB NOT NULL,
  request_body           JSONB NOT NULL,
  response_body          JSONB NOT NULL,
  phone                  VARCHAR(32) NOT NULL,
  country_code           VARCHAR(16) NOT NULL,
  total_amount           INTEGER,
  sync_status            VARCHAR(32) NOT NULL,
  user_id                UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id               UUID REFERENCES exhibit_orders(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_xc_order_sync_records_sync_status
    CHECK (sync_status IN ('SUCCESS', 'DUPLICATE_ORDER', 'FAILED'))
);

CREATE UNIQUE INDEX uq_xc_order_sync_records_sequence_id
  ON xc_order_sync_records(sequence_id);

CREATE INDEX idx_xc_order_sync_records_ota_order_id_created_at
  ON xc_order_sync_records(ota_order_id, created_at DESC);

CREATE INDEX idx_xc_order_sync_records_phone_country_code_created_at
  ON xc_order_sync_records(country_code, phone, created_at DESC);

CREATE INDEX idx_xc_order_sync_records_sync_status_created_at
  ON xc_order_sync_records(sync_status, created_at DESC);

CREATE INDEX idx_xc_order_sync_records_order_id
  ON xc_order_sync_records(order_id);

CREATE INDEX idx_xc_order_sync_records_user_id
  ON xc_order_sync_records(user_id);

-- Add source field to exhibit_orders to track OTA origin
ALTER TABLE exhibit_orders
  ADD COLUMN source VARCHAR(32);

UPDATE exhibit_orders
  SET source = 'DIRECT'
  WHERE source IS NULL;

ALTER TABLE exhibit_orders
  ALTER COLUMN source SET NOT NULL;