import { Pool } from "pg";

export type USER_DATA_ERROR_CODES =
| 'USER_NOT_FOUND';

export class UserDataError extends Error {
  code: USER_DATA_ERROR_CODES;

  constructor(message: string, code: USER_DATA_ERROR_CODES) {
    super(message);
    this.name = 'UserDataError';
    this.code = code;
  }
}

export async function createOrUpdateUser(
  client: Pool, schema: string,
  appid: string,
  openid: string, session_key: string
) {
  const { rows: [user] } = await client.query(
    `WITH upsert_wechat AS (
        INSERT INTO ${schema}.user_wechat (appid, openid, session_key, uid)
        VALUES ($1, $2, $3, GEN_RANDOM_UUID())
        ON CONFLICT (appid, openid) DO UPDATE SET
          session_key = EXCLUDED.session_key,
          updated_at = NOW()
        RETURNING uid
     ),
    upsert_user AS (
      INSERT INTO ${schema}.users (id, name)
      SELECT uid, $4 FROM upsert_wechat
      ON CONFLICT (id) DO NOTHING
      RETURNING id
     )
    SELECT id FROM upsert_user
      UNION ALL
    SELECT uid AS id FROM ${schema}.user_wechat WHERE appid = $1 AND openid = $2
      LIMIT 1`,
    [appid, openid, session_key, `wechat_${openid.slice(0, 8)}`]
  );

  return user;
}

export async function getUserProfile(
  client: Pool, schema: string, uid: string
) {
  const { rows } = await client.query(
    `SELECT u.id, u.name, uw.openid, u.created_at, uw.updated_at
     FROM ${schema}.users u
     LEFT JOIN ${schema}.user_wechat uw ON u.id = uw.uid
     WHERE u.id = $1`,
    [uid]
  );

  if (rows.length === 0) {
    throw new UserDataError('User not found', 'USER_NOT_FOUND');
  }

  return rows[0];
}