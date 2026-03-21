CREATE TABLE roles (
  id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  name                  VARCHAR(64) NOT NULL UNIQUE
);


CREATE TABLE user_roles (
  uid                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id               UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,

  PRIMARY KEY (uid, role_id)
);


CREATE TABLE user_phone (
  uid                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  country_code          VARCHAR(8) NOT NULL DEFAULT '+86',
  phone                 VARCHAR(32) NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (country_code, phone)
);


CREATE TABLE user_password (
  uid                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pass_hash             VARCHAR(255) NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX idx_user_wechat_uid ON user_wechat(uid);


INSERT INTO roles (name)
VALUES ('ADMIN')
ON CONFLICT (name) DO NOTHING;