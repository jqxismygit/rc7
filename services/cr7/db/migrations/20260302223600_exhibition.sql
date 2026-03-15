CREATE TABLE exhibitions (
	id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	name                  VARCHAR(255) NOT NULL UNIQUE,
	description           TEXT NOT NULL,
	start_date            DATE NOT NULL,
	end_date              DATE NOT NULL,
	opening_time          TIME NOT NULL,
	closing_time          TIME NOT NULL,
	last_entry_time       TIME NOT NULL,
	location              VARCHAR(255) NOT NULL,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT chk_exhibits_date_range CHECK (end_date >= start_date),
	CONSTRAINT chk_exhibits_time_range CHECK (closing_time > opening_time),
	CONSTRAINT chk_exhibits_last_entry CHECK (last_entry_time <= closing_time)
);


CREATE TABLE exhibit_ticket_categories (
	id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
	eid            				UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
	name                  VARCHAR(64) NOT NULL,
	price                 INTEGER NOT NULL,
	valid_duration_days   INTEGER NOT NULL,
	refund_policy        VARCHAR(32) NOT NULL,
	admittance            INTEGER NOT NULL DEFAULT 1,

	created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT uq_exhibit_ticket_categories_name UNIQUE (eid, name),
	CONSTRAINT chk_exhibit_ticket_categories_price CHECK (price >= 0),
	CONSTRAINT chk_exhibit_ticket_categories_valid_duration CHECK (valid_duration_days > 0),
	CONSTRAINT chk_exhibit_ticket_categories_admittance CHECK (admittance > 0)
);
