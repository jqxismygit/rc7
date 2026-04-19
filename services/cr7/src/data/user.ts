import { Client, Pool, PoolClient } from 'pg';

type DBClient = Pool | PoolClient | Client;

export type USER_DATA_ERROR_CODES
  = | 'USER_NOT_FOUND'
    | 'ROLE_NOT_FOUND'
    | 'ROLE_ALREADY_EXISTS'
    | 'BUILTIN_ROLE_CANNOT_DELETE'
    | 'BUILTIN_ROLE_CANNOT_UPDATE'
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
      u.avatar,
      COALESCE(u.profile, '{}'::jsonb) AS profile,
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
    role_id?: string;
    has_any_role?: boolean;
    damai_user_id?: string;
    page: number;
    limit: number;
  },
) {
  const { phone, role_id, has_any_role, damai_user_id, page, limit } = options;
  const offset = (page - 1) * limit;
  const filterParams = [
    phone ?? null,
    damai_user_id ?? null,
    role_id ?? null,
    has_any_role ?? null,
  ];

  const filterFromSql = `
    FROM ${schema}.users u
    LEFT JOIN ${schema}.user_damai ud ON u.id = ud.uid
    LEFT JOIN ${schema}.user_phone up ON u.id = up.uid`;

  const filterWhereSql = `
    WHERE ($1::text IS NULL OR up.phone = $1)
      AND ($2::text IS NULL OR ud.damai_user_id = $2)
      AND (
        $3::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM ${schema}.user_roles ur
          WHERE ur.uid = u.id
            AND ur.role_id = $3::uuid
        )
      )
      AND (
        $4::boolean IS NULL
        OR ($4::boolean = TRUE AND EXISTS (
          SELECT 1
          FROM ${schema}.user_roles ur_any
          WHERE ur_any.uid = u.id
        ))
        OR ($4::boolean = FALSE AND NOT EXISTS (
          SELECT 1
          FROM ${schema}.user_roles ur_any
          WHERE ur_any.uid = u.id
        ))
      )`;

  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
    ${filterFromSql}
    ${filterWhereSql}`,
    filterParams,
  );
  const total = parseInt(countRows[0].total, 10);

  const { rows: users } = await client.query(
    `SELECT
      u.id,
      u.name,
      u.avatar,
      COALESCE(u.profile, '{}'::jsonb) AS profile,
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
    ${filterFromSql}
    LEFT JOIN ${schema}.user_wechat uw ON u.id = uw.uid
    LEFT JOIN ${schema}.user_password upw ON u.id = upw.uid
    ${filterWhereSql}
      ORDER BY u.created_at DESC
      LIMIT $5 OFFSET $6`,
    [...filterParams, limit, offset],
  );

  // Fetch roles for all users in the list
  const userIds = users.map(u => u.id);
  const rolesByUserId: Record<string, Array<{ id: string; name: string; permissions: string[] }>> = {};

  if (userIds.length > 0) {
    const { rows: userRoles } = await client.query<{
      uid: string;
      id: string;
      name: string;
      permissions: string[];
    }>(
      `SELECT
        ur.uid,
        r.id,
        r.name,
        r.permissions
      FROM ${schema}.user_roles ur
      JOIN ${schema}.roles r ON ur.role_id = r.id
      WHERE ur.uid = ANY($1::uuid[])
      ORDER BY r.name`,
      [userIds]
    );

    for (const role of userRoles) {
      if (!rolesByUserId[role.uid]) {
        rolesByUserId[role.uid] = [];
      }
      rolesByUserId[role.uid].push({
        id: role.id,
        name: role.name,
        permissions: role.permissions,
      });
    }
  }

  // Add roles to each user
  const usersWithRoles = users.map(user => ({
    ...user,
    roles: rolesByUserId[user.id] || [],
  }));

  return {
    users: usersWithRoles,
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

export async function createUserByPhonePassword(
  client: DBClient,
  schema: string,
  input: {
    name: string;
    country_code: string;
    phone: string;
    password: string;
  },
) {
  const { name, country_code, phone, password } = input;

  try {
    const { rows: [user] } = await client.query<{ uid: string }>(
      `WITH created_user AS (
        INSERT INTO ${schema}.users (name)
        VALUES ($1)
        RETURNING id
      ),
      bind_phone AS (
        INSERT INTO ${schema}.user_phone (uid, country_code, phone)
        SELECT id, $2, $3
        FROM created_user
        RETURNING uid
      ),
      create_password AS (
        INSERT INTO ${schema}.user_password (uid, pass_hash)
        SELECT uid, CRYPT($4, GEN_SALT('bf'))
        FROM bind_phone
        RETURNING uid
      )
      SELECT uid FROM create_password
      LIMIT 1`,
      [name, country_code, phone, password],
    );

    return user.uid;
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new UserDataError('Phone already exists', 'PHONE_ALREADY_EXISTS');
    }

    throw error;
  }
}

export async function bindPhoneToUser(
  client: DBClient,
  schema: string,
  uid: string,
  country_code: string,
  phone: string,
) {
  try {
    const { rows: [user] } = await client.query<{ uid: string }>(
      `INSERT INTO ${schema}.user_phone (uid, country_code, phone)
      VALUES ($1, $2, $3)
      ON CONFLICT (uid) DO UPDATE SET
        country_code = EXCLUDED.country_code,
        phone = EXCLUDED.phone,
        updated_at = NOW()
      RETURNING uid`,
      [uid, country_code, phone],
    );

    return user.uid;
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new UserDataError('Phone already exists', 'PHONE_ALREADY_EXISTS');
    }
    throw error;
  }
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

export async function listRoles(
  client: DBClient,
  schema: string,
) {
  const { rows } = await client.query<{
    id: string;
    name: string;
    description: string;
    permissions: string[];
    is_builtin: boolean;
  }>(
    `SELECT
      id,
      name,
      description,
      permissions,
      is_builtin
    FROM ${schema}.roles
    ORDER BY name ASC`
  );

  return rows;
}

export async function createRole(
  client: DBClient,
  schema: string,
  input: {
    name: string;
    description?: string;
    permissions?: string[];
  },
) {
  const {
    name,
    description = '',
    permissions = [],
  } = input;

  try {
    const { rows: [role] } = await client.query<{
      id: string;
      name: string;
      description: string;
      permissions: string[];
      is_builtin: boolean;
    }>(
      `INSERT INTO ${schema}.roles (name, description, permissions)
      VALUES ($1, $2, $3::text[])
      RETURNING
        id,
        name,
        description,
        permissions,
        is_builtin`,
      [name, description, permissions],
    );

    return role;
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw new UserDataError('Role already exists', 'ROLE_ALREADY_EXISTS');
    }

    throw error;
  }
}

export async function deleteRoleById(
  client: DBClient,
  schema: string,
  roleId: string,
) {
  const { rows: roleRows } = await client.query<{
    id: string;
    is_builtin: boolean;
  }>(
    `SELECT id, is_builtin
    FROM ${schema}.roles
    WHERE id = $1
    LIMIT 1`,
    [roleId],
  );

  const role = roleRows[0] ?? null;
  if (role === null) {
    throw new UserDataError('Role not found', 'ROLE_NOT_FOUND');
  }

  if (role.is_builtin === true) {
    throw new UserDataError('Builtin role cannot delete', 'BUILTIN_ROLE_CANNOT_DELETE');
  }

  await client.query(
    `DELETE FROM ${schema}.roles
    WHERE id = $1`,
    [role.id],
  );
}

export async function updateRole(
  client: DBClient,
  schema: string,
  roleId: string,
  input: {
    name?: string;
    description?: string;
    permissions?: string[];
  },
) {
  const { rows: roleRows } = await client.query<{
    id: string;
    is_builtin: boolean;
  }>(
    `SELECT id, is_builtin
    FROM ${schema}.roles
    WHERE id = $1
    LIMIT 1`,
    [roleId],
  );

  const role = roleRows[0] ?? null;
  if (role === null) {
    throw new UserDataError('Role not found', 'ROLE_NOT_FOUND');
  }

  if (role.is_builtin === true) {
    throw new UserDataError('Builtin role cannot update', 'BUILTIN_ROLE_CANNOT_UPDATE');
  }

  const updates: string[] = [];
  const values: (string | string[] | undefined)[] = [];
  let paramCount = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramCount}`);
    values.push(input.name);
    paramCount++;
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramCount}`);
    values.push(input.description);
    paramCount++;
  }

  if (input.permissions !== undefined) {
    updates.push(`permissions = $${paramCount}::text[]`);
    values.push(input.permissions);
    paramCount++;
  }

  if (updates.length === 0) {
    // If no updates provided, return the existing role
    const { rows: [existingRole] } = await client.query<{
      id: string;
      name: string;
      description: string;
      permissions: string[];
      is_builtin: boolean;
    }>(
      `SELECT
        id,
        name,
        description,
        permissions,
        is_builtin
      FROM ${schema}.roles
      WHERE id = $1`,
      [roleId],
    );

    return existingRole;
  }

  values.push(roleId);
  const { rows: [updatedRole] } = await client.query<{
    id: string;
    name: string;
    description: string;
    permissions: string[];
    is_builtin: boolean;
  }>(
    `UPDATE ${schema}.roles
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING
      id,
      name,
      description,
      permissions,
      is_builtin`,
    values,
  );

  return updatedRole;
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

export async function revokeRoleFromUser(
  client: DBClient,
  schema: string,
  uid: string,
  roleId: string,
) {
  await client.query(
    `DELETE FROM ${schema}.user_roles
    WHERE uid = $1
      AND role_id = $2`,
    [uid, roleId],
  );
}

export async function getUserRoles(
  client: DBClient,
  schema: string,
  uid: string,
) {
  const { rows } = await client.query<{
    id: string;
    name: string;
    permissions: string[];
  }>(
    `SELECT
      r.id,
      r.name,
      r.permissions
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

export async function updateUserProfile(
  client: DBClient,
  schema: string,
  uid: string,
  input: {
    name?: string;
    avatar?: string;
    profile?: Record<string, unknown>;
  },
) {
  const { name, avatar, profile } = input;

  const { rows: updatedRows } = await client.query<{ id: string }>(
    `UPDATE ${schema}.users
    SET
      name = COALESCE($2, name),
      avatar = COALESCE($3, avatar),
      profile = CASE
        WHEN $4::jsonb IS NULL THEN profile
        ELSE COALESCE(profile, '{}'::jsonb) || $4::jsonb
      END,
      updated_at = CASE
        WHEN $2::text IS NULL
          AND $3::text IS NULL
          AND $4::jsonb IS NULL
        THEN updated_at
        ELSE NOW()
      END
    WHERE id = $1
    RETURNING id`,
    [uid, name ?? null, avatar ?? null, profile ? JSON.stringify(profile) : null],
  );

  if (updatedRows.length === 0) {
    throw new UserDataError('User not found', 'USER_NOT_FOUND');
  }
}
