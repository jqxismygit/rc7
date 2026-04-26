ALTER TABLE exhibit_redemption_codes
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'ORDER',
  ADD COLUMN cdkey VARCHAR(32) REFERENCES exhibit_cdkeys(code),
  ADD COLUMN session_id UUID REFERENCES exhibit_sessions(id) ON DELETE SET NULL;

UPDATE exhibit_redemption_codes rc
SET
  session_id = o.session_id
FROM exhibit_orders o
WHERE rc.order_id = o.id
  AND rc.source = 'ORDER';

ALTER TABLE exhibit_redemption_codes
  ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE exhibit_redemption_codes
  ADD CONSTRAINT chk_redemption_code_source
    CHECK (source IN ('ORDER', 'CDKEY')),
  ADD CONSTRAINT chk_redemption_code_source_fields
    CHECK (
      (
        source = 'ORDER'
        AND order_id IS NOT NULL
        AND cdkey IS NULL
      )
      OR
      (
        source = 'CDKEY'
        AND order_id IS NULL
        AND cdkey IS NOT NULL
      )
    );

ALTER TABLE exhibit_redemption_codes
  ADD CONSTRAINT uq_redemption_code_cdkey_code UNIQUE (cdkey);

CREATE INDEX idx_redemption_code_session_id ON exhibit_redemption_codes(session_id);
