-- Add owner_user_id to redemption codes to support code transfers
ALTER TABLE exhibit_redemption_codes
  ADD COLUMN owner_user_id UUID REFERENCES users(id);

-- Backfill owner_user_id from the associated order's user_id
UPDATE exhibit_redemption_codes rc
SET owner_user_id = o.user_id
FROM exhibit_orders o
WHERE o.id = rc.order_id;

-- Enforce NOT NULL after backfill
ALTER TABLE exhibit_redemption_codes
  ALTER COLUMN owner_user_id SET NOT NULL;

CREATE INDEX idx_redemption_code_owner ON exhibit_redemption_codes(owner_user_id);

-- Transfer log table: records each ownership change of a redemption code
CREATE TABLE exhibit_redemption_code_transfers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(32) NOT NULL,
  exhibit_id    UUID        NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  from_user_id  UUID        NOT NULL REFERENCES users(id),
  to_user_id    UUID        NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_redemption_transfer_exhibit_code
  ON exhibit_redemption_code_transfers(exhibit_id, code);
