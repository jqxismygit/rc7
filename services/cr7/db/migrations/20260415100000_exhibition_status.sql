ALTER TABLE exhibitions
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'DISABLE';

ALTER TABLE exhibitions
  ADD CONSTRAINT chk_exhibitions_status
  CHECK (status IN ('ENABLE', 'DISABLE'));

CREATE INDEX idx_exhibitions_status_created_at ON exhibitions(status, created_at DESC);
