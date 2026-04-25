CREATE TABLE exhibit_cdkey_batches (
  id                  UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  exhibit_id          UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  name                VARCHAR(128) NOT NULL,
  ticket_category_id  UUID NOT NULL REFERENCES exhibit_ticket_categories(id) ON DELETE CASCADE,
  redeem_quantity     INTEGER NOT NULL,
  quantity            INTEGER NOT NULL,
  redeem_valid_until  DATE NOT NULL,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_exhibit_cdkey_batches_redeem_quantity CHECK (redeem_quantity > 0),
  CONSTRAINT chk_exhibit_cdkey_batches_quantity CHECK (quantity > 0)
);

CREATE TABLE exhibit_cdkeys (
  id                  UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  batch_id            UUID NOT NULL REFERENCES exhibit_cdkey_batches(id) ON DELETE CASCADE,
  exhibit_id          UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  ticket_category_id  UUID NOT NULL REFERENCES exhibit_ticket_categories(id) ON DELETE CASCADE,
  code                VARCHAR(32) NOT NULL UNIQUE,
  redeem_quantity     INTEGER NOT NULL,
  redeem_valid_until  DATE NOT NULL,
  redeemed_session_id UUID REFERENCES exhibit_sessions(id) ON DELETE SET NULL,
  redeemed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_exhibit_cdkeys_redeem_quantity CHECK (redeem_quantity > 0),
  CONSTRAINT chk_exhibit_cdkeys_redeemed_consistency
    CHECK (
      (redeemed_at IS NOT NULL AND redeemed_session_id IS NOT NULL AND redeemed_by IS NOT NULL)
      OR
      (redeemed_at IS NULL AND redeemed_session_id IS NULL AND redeemed_by IS NULL)
    )
);

CREATE INDEX idx_exhibit_cdkey_batches_exhibit_id ON exhibit_cdkey_batches(exhibit_id);
CREATE INDEX idx_exhibit_cdkey_batches_ticket_category_id ON exhibit_cdkey_batches(ticket_category_id);

CREATE INDEX idx_exhibit_cdkeys_batch_id ON exhibit_cdkeys(batch_id);
CREATE INDEX idx_exhibit_cdkeys_exhibit_id ON exhibit_cdkeys(exhibit_id);
CREATE INDEX idx_exhibit_cdkeys_ticket_category_id ON exhibit_cdkeys(ticket_category_id);
