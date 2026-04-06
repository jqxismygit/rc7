CREATE TABLE mop_order_sync_records (
  id              UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  my_order_id     VARCHAR(128),
  request_path    VARCHAR(128) NOT NULL,
  request_body    JSONB NOT NULL,
  response_body   JSONB,
  sync_status     VARCHAR(32) NOT NULL,
  order_id        UUID REFERENCES exhibit_orders(id),
  user_id         UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_mop_order_sync_records_status
    CHECK (sync_status IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX idx_mop_order_sync_records_my_order_id_created_at
  ON mop_order_sync_records(my_order_id, created_at DESC);

CREATE INDEX idx_mop_order_sync_records_order_id
  ON mop_order_sync_records(order_id);

CREATE INDEX idx_mop_order_sync_records_user_id
  ON mop_order_sync_records(user_id);