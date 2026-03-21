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
    demandOption: true,
    describe: '登录密码'
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
    password: string;
  }
) {
  const {
    schema,
    countryCode = '+86',
    phone,
    password,
  } = args;

  const uid = await upsertUserByPhone(client, schema, countryCode, phone, 'system admin');

  const roleId = await getRoleIdByName(client, schema, 'ADMIN');

  await assignRoleToUser(client, schema, uid, roleId)
    .then(() => upsertUserPassword(client, schema, uid, password));

  return getUserProfile(client, schema, uid);
}

export const handler = dbClientWrapper(initAdmin);
