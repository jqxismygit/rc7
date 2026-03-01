CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  name                  VARCHAR(255) NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE user_wechat(
  uid                   UUID PRIMARY KEY,
  openid                VARCHAR(255) NOT NULL,
  session_key           VARCHAR(255) NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (uid)     REFERENCES users(id) ON DELETE CASCADE
);
