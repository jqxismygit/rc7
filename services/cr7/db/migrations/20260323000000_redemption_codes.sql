-- Create redemption codes table
CREATE TABLE exhibit_redemption_codes (
	code                  VARCHAR(32) NOT NULL PRIMARY KEY,
	order_id              UUID NOT NULL UNIQUE REFERENCES exhibit_orders(id) ON DELETE CASCADE,
	status                VARCHAR(20) NOT NULL DEFAULT 'UNREDEEMED',

	quantity              INTEGER NOT NULL,
	valid_from            TIMESTAMPTZ NOT NULL,
	valid_until           TIMESTAMPTZ NOT NULL,
	redeemed_at           TIMESTAMPTZ,
	redeemed_by           UUID REFERENCES users(id) ON DELETE SET NULL,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT chk_redemption_code_status CHECK (status IN ('UNREDEEMED', 'REDEEMED')),
	CONSTRAINT chk_redemption_code_quantity CHECK (quantity > 0),
	CONSTRAINT chk_redemption_code_redeemed_vs_status
		CHECK ((status = 'REDEEMED' AND redeemed_at IS NOT NULL AND redeemed_by IS NOT NULL) OR (status = 'UNREDEEMED' AND redeemed_at IS NULL AND redeemed_by IS NULL)),
	CONSTRAINT chk_redemption_code_valid_period CHECK (valid_until > valid_from)
);

-- Create indexes for efficient queries
CREATE UNIQUE INDEX idx_redemption_code_code ON exhibit_redemption_codes(code);
CREATE INDEX idx_redemption_code_order_id ON exhibit_redemption_codes(order_id);
CREATE INDEX idx_redemption_code_status ON exhibit_redemption_codes(status);
CREATE INDEX idx_redemption_code_valid_period ON exhibit_redemption_codes(valid_from, valid_until)
	WHERE status = 'UNREDEEMED';
