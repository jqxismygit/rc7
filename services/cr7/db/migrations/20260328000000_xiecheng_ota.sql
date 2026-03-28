ALTER TABLE exhibit_ticket_categories
ADD COLUMN ota_xc_option_id VARCHAR(255);

CREATE TABLE exhibit_xc_sync_logs (
  sequence_id           UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  ticket_category_id    UUID NOT NULL,
  service_name          VARCHAR(64) NOT NULL,
  ota_option_id         VARCHAR(255) NOT NULL,
  sync_items            JSONB NOT NULL,
  sync_response         JSONB,
  status                VARCHAR(20) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_exhibit_xc_sync_logs_service_name
    CHECK (service_name IN ('DatePriceModify', 'DateInventoryModify')),
  CONSTRAINT chk_exhibit_xc_sync_logs_status
    CHECK (status IN ('SUCCESS', 'FAILURE'))
);

CREATE INDEX idx_exhibit_xc_sync_logs_ticket_category_id
ON exhibit_xc_sync_logs(ticket_category_id);

CREATE INDEX idx_exhibit_xc_sync_logs_created_at
ON exhibit_xc_sync_logs(created_at DESC);
