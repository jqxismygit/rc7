import { Client } from "pg";

export async function createOrUpdateUser(
  client: Client, openid: string, session_key: string
) {
  // 查询是否已存在该用户
  const userResult = await client.query(
    'SELECT uid, openid FROM user_wechat WHERE openid = $1',
    [openid]
  );

  if (userResult.rows.length > 0) {
    // 用户已存在，更新 session_key
    const { uid } = userResult.rows[0];
    await client.query(
      'UPDATE user_wechat SET session_key = $1, updated_at = NOW() WHERE uid = $2',
      [session_key, uid]
    );

    const { rows: [user] } = await client.query(
      'SELECT id, name, created_at FROM users WHERE id = $1',
      [uid]
    );

    return user;
  }

  // 新用户，创建用户记录
  const newUserResult = await client.query(
    'INSERT INTO users (name) VALUES ($1) RETURNING id, name, created_at',
    [`user_${openid.slice(0, 8)}`]
  );

  const newUser = newUserResult.rows[0];

  // 创建 user_wechat 记录
  await client.query(
    'INSERT INTO user_wechat (uid, openid, session_key) VALUES ($1, $2, $3)',
    [newUser.id, openid, session_key]
  );

  return newUser;
}