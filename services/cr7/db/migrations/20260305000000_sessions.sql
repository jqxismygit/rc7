-- Create sessions table
CREATE TABLE exhibit_sessions (
	id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	session_id            UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
	session_date          DATE NOT NULL,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT uq_exhibit_sessions_date UNIQUE (session_id, session_date)
);


-- Create session inventory table
CREATE TABLE exhibit_session_inventories (
	id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	session_id            UUID NOT NULL REFERENCES exhibit_sessions(id) ON DELETE CASCADE,
	ticket_category_id    UUID NOT NULL REFERENCES exhibit_ticket_categories(id) ON DELETE CASCADE,
	quantity              INTEGER NOT NULL DEFAULT 0,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT uq_session_inventory UNIQUE (session_id, ticket_category_id),
	CONSTRAINT chk_session_inventory_quantity CHECK (quantity >= 0)
);

-- Create index for efficient queries
CREATE INDEX idx_exhibit_sessions_session_id ON exhibit_sessions(session_id);
CREATE INDEX idx_exhibit_session_inventories_session_id ON exhibit_session_inventories(session_id);
CREATE INDEX idx_exhibit_session_inventories_ticket_category_id ON exhibit_session_inventories(ticket_category_id);
