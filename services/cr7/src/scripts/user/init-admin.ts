import { Client } from 'pg';
import { dbClientWrapper } from '../utils.js';
import {
  assignRoleToUser,
  getRoleIdByName,
  getUserProfile,
  upsertUserByPhone,
  upsertUserPassword,
} from '../../data/user.js';

export const command = 'init-admin';
export const describe = '初始化系统管理员账号';

export const builder = {
  countryCode: {
    alias: 'country-code',
    type: 'string',
    default: '+86',
    describe: '手机号国别码'
  },
  phone: {
    type: 'string',
    demandOption: true,
    describe: '手机号'
  },
  password: {
    type: 'string',
    demandOption: false,
    describe: '登录密码（首次设置管理员密码时必填）'
  },
  schema: {
    type: 'string',
    demandOption: true,
    describe: '数据库 schema 名称'
  }
};

export async function initAdmin(
  client: Client,
  args: {
    schema: string;
    countryCode?: string;
    phone: string;
    password?: string;
  }
) {
  const {
    schema,
    countryCode = '+86',
    phone,
    password = null,
  } = args;

  const uid = await upsertUserByPhone(client, schema, countryCode, phone, 'system admin');

  const roleId = await getRoleIdByName(client, schema, 'ADMIN');

  await assignRoleToUser(client, schema, uid, roleId);

  const userProfile = await getUserProfile(client, schema, uid);
  const passwordExists = userProfile.auth_methods.includes('PASSWORD');
  const passwordLen = password?.length ?? 0;

  if (passwordLen === 0 && passwordExists === false) {
    throw new Error('管理员账号尚未设置密码，请通过 --password 指定初始密码');
  }

  if (passwordLen > 0) {
    await upsertUserPassword(client, schema, uid, password);
  }

  return getUserProfile(client, schema, uid);
}

export const handler = dbClientWrapper(initAdmin);
