CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  name                  VARCHAR(255) NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE user_wechat(
  uid                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appid                 VARCHAR(255) NOT NULL,
  openid                VARCHAR(255) NOT NULL,
  session_key           VARCHAR(255) NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (appid, openid)
);
