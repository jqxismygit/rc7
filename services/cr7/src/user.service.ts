import { Context, Errors, Service, ServiceBroker } from 'moleculer';
import { Pool } from 'pg';
import { jscode2session } from './libs/wechat.js';
import {
  createOrUpdateUser,
  getUserProfile,
  listUserProfiles,
  getUserRoles,
  loginByPhonePassword,
  updatePassword,
  getRoleIdByName,
  assignRoleToUser,
  upsertUserByPhone,
} from './data/user.js';
import { handleUserError } from './libs/errors.js';

interface UserMeta {
  uid: string;
}

const { MoleculerClientError } = Errors;

export default class UserService extends Service {
  pool!: Pool;

  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'user',
      settings: {
        rest: '/users',
        $noVersionPrefix: true,
      },

      actions: {
        wechat_mini_login: {
          rest: 'POST /login/wechat/mini',
          params: {
            code: 'string'
          },
          handler: this.wechat_mini_login
        },

        password_login: {
          rest: 'POST /login/password',
          params: {
            country_code: {
              type: 'string',
              optional: true,
              default: '+86',
            },
            phone: 'string',
            password: 'string',
          },
          handler: this.password_login,
        },

        password_update: {
          rest: 'PUT /password',
          params: {
            current_password: 'string',
            new_password: 'string',
          },
          handler: this.password_update,
        },

        profile: {
          rest: 'GET /profile',
          handler: this.profile
        },

        roles: this.getRoleNames,

        grant_role: {
          rest: 'POST /:uid/roles',
          roles: ['admin'],
          params: {
            uid: 'uuid',
            role_name: 'string',
          },
          handler: this.grant_role,
        },

        list: {
          rest: 'GET /',
          roles: ['admin'],
          params: {
            phone: {
              type: 'string',
              optional: true,
            },
            page: {
              type: 'number',
              integer: true,
              positive: true,
              optional: true,
              default: 1,
              convert: true,
            },
            limit: {
              type: 'number',
              integer: true,
              positive: true,
              optional: true,
              default: 20,
              convert: true,
            },
          },
          handler: this.list,
        },

        su: {
          rest: 'POST /su',
          roles: ['admin'],
          params: {
            uid: 'uuid',
          },
          handler(ctx) {
            const { uid } = ctx.params;
            return { token: { uid } };
          }
        },

        findOrCreateByPhone: {
          visibility: 'protected',
          params: {
            country_code: 'string',
            phone: 'string',
            name: 'string',
          },
          handler: this.findOrCreateByPhone,
        },
      },

      async started() {
        const { default: config } = await import('config');
        this.pool = new Pool(config.pg);
      },

      async stopped() {
        await this.pool.end();
      }
    })
  }

  async wechat_mini_login(ctx: Context<{ code: string }>) {
    const { code } = ctx.params;
    const client = this.pool;
    const schema = await this.getSchema();
    const wechatConfig = await this.getWechatConfig();
    const { appid } = wechatConfig;

    // 调用微信接口获取 openid 和 session_key
    const wechatResult = await jscode2session(wechatConfig, code);
    const { openid, session_key } = wechatResult;

    const user = await createOrUpdateUser(client, schema, appid, openid, session_key);

    return { token: { uid: user.id } };
  }

  async profile(ctx: Context<void, { user: UserMeta }>) {
    const { uid } = ctx.meta.user;
    const client = this.pool;
    const schema = await this.getSchema();

    const profile = await getUserProfile(client, schema, uid)
      .then(res => res, handleUserError);

    return profile;
  }

  async password_login(
    ctx: Context<{ country_code?: string; phone: string; password: string }>
  ) {
    const {
      country_code = '+86',
      phone,
      password,
    } = ctx.params;
    const schema = await this.getSchema();

    const user = await loginByPhonePassword(this.pool, schema, {
        country_code,
        phone,
        password,
      })
      .catch(handleUserError);

    return { token: { uid: user.uid } };
  }

  async password_update(
    ctx: Context<
      { current_password: string; new_password: string },
      { user: UserMeta; $statusCode?: number }
    >
  ) {
    const { current_password, new_password } = ctx.params;
    const { uid } = ctx.meta.user;

    if (current_password === new_password) {
      throw new MoleculerClientError('新旧密码不能相同', 400, 'INVALID_ARGUMENT');
    }

    const schema = await this.getSchema();
    await updatePassword(this.pool, schema, uid, current_password, new_password)
      .catch(handleUserError);

    ctx.meta.$statusCode = 204;
    return null;
  }

  async getRoleNames(ctx: Context<void, { user: UserMeta }>) {
    const { uid } = ctx.meta.user;
    const client = this.pool;
    const schema = await this.getSchema();

    const roles = await getUserRoles(client, schema, uid);
    return roles.map(role => role.name);
  }

  async getSchema() {
    const { default: config } = await import('config');
    return config.pg.schema;
  }

  async getWechatConfig() {
    const { default: config } = await import('config');
    return config.wechat;
  }

  async grant_role(
    ctx: Context<{ uid: string; role_name: string }, { user: UserMeta }>
  ) {
    const { uid, role_name } = ctx.params;
    const schema = await this.getSchema();

    const roleId = await getRoleIdByName(this.pool, schema, role_name)
      .catch(handleUserError);

    await assignRoleToUser(this.pool, schema, uid, roleId);

    const roles = await getUserRoles(this.pool, schema, uid);
    return { role_names: roles.map(role => role.name) };
  }

  async list(ctx: Context<{ phone?: string; page?: number; limit?: number }>) {
    const schema = await this.getSchema();
    const { phone, page = 1, limit = 20 } = ctx.params;

    const users = await listUserProfiles(this.pool, schema, { phone, page, limit });
    return users;
  }

  async findOrCreateByPhone(
    ctx: Context<{ country_code: string; phone: string; name: string }>
  ) {
    const { country_code, phone, name } = ctx.params;
    const schema = await this.getSchema();
    const uid = await upsertUserByPhone(this.pool, schema, country_code, phone, name);
    return uid;
  }
}
