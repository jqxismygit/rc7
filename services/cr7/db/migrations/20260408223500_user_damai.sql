CREATE TABLE user_damai (
  uid                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  damai_user_id         VARCHAR(255) NOT NULL PRIMARY KEY,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX idx_user_damai_uid ON user_damai(uid);