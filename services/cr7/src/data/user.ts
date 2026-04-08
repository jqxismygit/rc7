import { Client, Pool, PoolClient } from 'pg';

type DBClient = Pool | PoolClient | Client;

export type USER_DATA_ERROR_CODES =
| 'USER_NOT_FOUND'
| 'ROLE_NOT_FOUND'
| 'PHONE_ALREADY_EXISTS'
| 'INVALID_PHONE_OR_PASSWORD'
| 'USER_PASSWORD_NOT_FOUND'
| 'PASSWORD_MISMATCH';

export class UserDataError extends Error {
  code: USER_DATA_ERROR_CODES;

  constructor(message: string, code: USER_DATA_ERROR_CODES) {
    super(message);
    this.name = 'UserDataError';
    this.code = code;
  }
}

export async function createOrUpdateUser(
  client: DBClient, schema: string,
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
  client: DBClient, schema: string, uid: string
) {
  const { rows } = await client.query(
    `SELECT
      u.id,
      u.name,
      ud.damai_user_id,
      uw.openid,
      CASE
        WHEN up.uid IS NULL THEN NULL
        ELSE up.country_code || ' ' || up.phone
      END AS phone,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN ud.uid IS NOT NULL THEN 'DAMAI' END,
        CASE WHEN uw.uid IS NOT NULL THEN 'WECHAT_MINI' END,
        CASE WHEN upw.uid IS NOT NULL THEN 'PASSWORD' END
      ], NULL)::text[] AS auth_methods,
      u.created_at,
      GREATEST(
        u.updated_at,
        COALESCE(ud.updated_at, u.updated_at),
        COALESCE(uw.updated_at, u.updated_at),
        COALESCE(up.updated_at, u.updated_at),
        COALESCE(upw.updated_at, u.updated_at)
      ) AS updated_at
     FROM ${schema}.users u
     LEFT JOIN ${schema}.user_damai ud ON u.id = ud.uid
     LEFT JOIN ${schema}.user_wechat uw ON u.id = uw.uid
     LEFT JOIN ${schema}.user_phone up ON u.id = up.uid
     LEFT JOIN ${schema}.user_password upw ON u.id = upw.uid
     WHERE u.id = $1`,
    [uid]
  );

  if (rows.length === 0) {
    throw new UserDataError('User not found', 'USER_NOT_FOUND');
  }

  return rows[0];
}

export async function listUserProfiles(
  client: DBClient,
  schema: string,
  options: {
    phone?: string;
    damai_user_id?: string;
    page: number;
    limit: number;
  },
) {
  const { phone, damai_user_id, page, limit } = options;
  const offset = (page - 1) * limit;

  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
    FROM ${schema}.users u
    LEFT JOIN ${schema}.user_damai ud ON u.id = ud.uid
    LEFT JOIN ${schema}.user_phone up ON u.id = up.uid
    WHERE ($1::text IS NULL OR up.phone = $1)
      AND ($2::text IS NULL OR ud.damai_user_id = $2)`,
    [phone ?? null, damai_user_id ?? null],
  );
  const total = parseInt(countRows[0].total, 10);

  const { rows: users } = await client.query(
    `SELECT
      u.id,
      u.name,
      ud.damai_user_id,
      uw.openid,
      CASE
        WHEN up.uid IS NULL THEN NULL
        ELSE up.country_code || ' ' || up.phone
      END AS phone,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN ud.uid IS NOT NULL THEN 'DAMAI' END,
        CASE WHEN uw.uid IS NOT NULL THEN 'WECHAT_MINI' END,
        CASE WHEN upw.uid IS NOT NULL THEN 'PASSWORD' END
      ], NULL)::text[] AS auth_methods,
      u.created_at,
      GREATEST(
        u.updated_at,
        COALESCE(ud.updated_at, u.updated_at),
        COALESCE(uw.updated_at, u.updated_at),
        COALESCE(up.updated_at, u.updated_at),
        COALESCE(upw.updated_at, u.updated_at)
      ) AS updated_at
    FROM ${schema}.users u
    LEFT JOIN ${schema}.user_damai ud ON u.id = ud.uid
    LEFT JOIN ${schema}.user_wechat uw ON u.id = uw.uid
    LEFT JOIN ${schema}.user_phone up ON u.id = up.uid
    LEFT JOIN ${schema}.user_password upw ON u.id = upw.uid
    WHERE ($1::text IS NULL OR up.phone = $1)
      AND ($2::text IS NULL OR ud.damai_user_id = $2)
      ORDER BY u.created_at DESC
      LIMIT $3 OFFSET $4`,
    [phone ?? null, damai_user_id ?? null, limit, offset],
  );

  return {
    users,
    total,
    page,
    limit,
  };
}

export async function getUserIdByPhone(
  client: DBClient,
  schema: string,
  country_code: string,
  phone: string,
) {
  const { rows: existingPhoneRows } = await client.query<{ uid: string }>(
    `SELECT uid
    FROM ${schema}.user_phone
    WHERE country_code = $1
      AND phone = $2
    LIMIT 1`,
    [country_code, phone]
  );

  return existingPhoneRows[0]?.uid ?? null;
}

export async function upsertUserByPhone(
  client: DBClient,
  schema: string,
  country_code: string,
  phone: string,
  name: string,
) {
  const { rows: [user] } = await client.query<{ uid: string }>(
    `WITH existing AS (
      SELECT uid
      FROM ${schema}.user_phone
      WHERE country_code = $1
        AND phone = $2
      LIMIT 1
    ),
    created_user AS (
      INSERT INTO ${schema}.users (name)
      SELECT $3
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      RETURNING id
    ),
    upsert_phone AS (
      INSERT INTO ${schema}.user_phone (uid, country_code, phone)
      SELECT id, $1, $2
      FROM created_user
      ON CONFLICT (country_code, phone) DO UPDATE SET
        country_code = EXCLUDED.country_code
      RETURNING uid
    )
    SELECT uid FROM existing
    UNION ALL
    SELECT uid FROM upsert_phone
    LIMIT 1`,
    [country_code, phone, name],
  );

  return user.uid;
}

export async function upsertUserByDamaiId(
  client: DBClient,
  schema: string,
  damai_user_id: string,
  name: string,
) {
  const { rows: [user] } = await client.query<{ uid: string }>(
    `WITH upsert_damai AS (
      INSERT INTO ${schema}.user_damai (uid, damai_user_id)
      VALUES (GEN_RANDOM_UUID(), $1)
      ON CONFLICT (damai_user_id) DO NOTHING
      RETURNING uid
    ),
    created_user AS (
      INSERT INTO ${schema}.users (id, name)
      SELECT uid, $2
      FROM upsert_damai
      ON CONFLICT (id) DO NOTHING
      RETURNING id AS uid
    )
    SELECT uid FROM created_user
    UNION ALL
    SELECT uid FROM ${schema}.user_damai WHERE damai_user_id = $1
    LIMIT 1`,
    [damai_user_id, name],
  );

  return user.uid;
}

export async function getRoleIdByName(
  client: DBClient,
  schema: string,
  name: string,
) {
  const { rows: roleRows } = await client.query<{ id: string }>(
    `SELECT id
    FROM ${schema}.roles
    WHERE name = $1
    LIMIT 1`,
    [name]
  );

  const roleId = roleRows[0]?.id;
  if (roleId === undefined) {
    throw new UserDataError('Role not found', 'ROLE_NOT_FOUND');
  }

  return roleId;
}

export async function assignRoleToUser(
  client: DBClient,
  schema: string,
  uid: string,
  roleId: string,
) {
  await client.query(
    `INSERT INTO ${schema}.user_roles (uid, role_id)
    VALUES ($1, $2)
    ON CONFLICT (uid, role_id) DO NOTHING`,
    [uid, roleId],
  );
}

export async function getUserRoles(
  client: DBClient,
  schema: string,
  uid: string,
) {
  const { rows } = await client.query<{ id: string; name: string }>(
    `SELECT r.id, r.name
    FROM ${schema}.user_roles ur
    JOIN ${schema}.roles r ON ur.role_id = r.id
    WHERE ur.uid = $1`,
    [uid]
  );

  return rows;
}

export async function upsertUserPassword(
  client: DBClient,
  schema: string,
  uid: string,
  password: string,
) {
  await client.query(
    `INSERT INTO ${schema}.user_password (uid, pass_hash)
    VALUES ($1, CRYPT($2, GEN_SALT('bf')))
    ON CONFLICT (uid) DO UPDATE SET
      pass_hash = EXCLUDED.pass_hash,
      updated_at = NOW()`,
    [uid, password],
  );
}

export async function loginByPhonePassword(
  client: DBClient,
  schema: string,
  input: {
    country_code: string;
    phone: string;
    password: string;
  }
) {
  const { country_code, phone, password } = input;

  const { rows } = await client.query<{ uid: string }>(
    `SELECT
      up.uid
    FROM ${schema}.user_phone up
    JOIN ${schema}.user_password upw ON up.uid = upw.uid
    WHERE up.country_code = $1
      AND up.phone = $2
      AND upw.pass_hash = CRYPT($3, upw.pass_hash)
    LIMIT 1`,
    [country_code, phone, password]
  );

  if (rows.length === 0) {
    throw new UserDataError('Invalid phone or password', 'INVALID_PHONE_OR_PASSWORD');
  }

  return { uid: rows[0].uid };
}

export async function updatePassword(
  client: DBClient,
  schema: string,
  uid: string,
  current_password: string,
  new_password: string,
) {
  const { rows: updatedRows } = await client.query<{ uid: string }>(
    `UPDATE ${schema}.user_password
    SET
      pass_hash = CRYPT($3, GEN_SALT('bf')),
      updated_at = NOW()
    WHERE uid = $1
      AND pass_hash = CRYPT($2, pass_hash)
    RETURNING uid`,
    [uid, current_password, new_password],
  );

  if (updatedRows.length > 0) {
    return;
  }

  const { rows: passwordRows } = await client.query<{ uid: string }>(
    `SELECT uid
    FROM ${schema}.user_password
    WHERE uid = $1
    LIMIT 1`,
    [uid],
  );

  if (passwordRows.length === 0) {
    throw new UserDataError('User password not found', 'USER_PASSWORD_NOT_FOUND');
  }

  throw new UserDataError('Password mismatch', 'PASSWORD_MISMATCH');
}