import { Context, Errors, Service, ServiceBroker } from 'moleculer';
import { Pool } from 'pg';
import {
  getWechatUserPhoneNumber,
  jscode2session,
} from './libs/wechat.js';
import {
  bindPhoneToUser,
  createOrUpdateUser,
  getUserProfile,
  listUserProfiles,
  getUserRoles,
  loginByPhonePassword,
  updatePassword,
  getRoleIdByName,
  assignRoleToUser,
  listRoles,
  createRole,
  deleteRoleById,
  createUserByPhonePassword,
  upsertUserByDamaiId,
  upsertUserByPhone,
  updateUserProfile,
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

        wechat_bind_phone: {
          rest: 'POST /phone/wechat',
          params: {
            code: 'string',
          },
          handler: this.wechat_bind_phone,
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

        profile_update: {
          rest: 'PUT /profile',
          params: {
            name: {
              type: 'string',
              optional: true,
            },
            avatar: {
              type: 'string',
              optional: true,
            },
            profile: {
              type: 'object',
              optional: true,
            },
          },
          handler: this.profile_update,
        },

        roles: {
          rest: 'GET /roles',
          handler: this.getRoleNames,
        },

        grant_role: {
          rest: 'POST /:uid/roles',
          roles: ['admin'],
          params: {
            uid: 'uuid',
            role_name: 'string',
          },
          handler: this.grant_role,
        },

        list_roles: {
          rest: 'GET /roles',
          roles: ['admin'],
          handler: this.list_roles,
        },

        create_role: {
          rest: 'POST /roles',
          roles: ['admin'],
          params: {
            name: 'string',
            description: {
              type: 'string',
              optional: true,
              default: '',
            },
            permissions: {
              type: 'array',
              items: 'string',
              optional: true,
              default: [],
            },
          },
          handler: this.create_role,
        },

        delete_role: {
          rest: 'DELETE /roles/:role_id',
          roles: ['admin'],
          params: {
            role_id: 'uuid',
          },
          handler: this.delete_role,
        },

        list: {
          rest: 'GET /',
          roles: ['admin'],
          params: {
            phone: {
              type: 'string',
              optional: true,
            },
            damai_user_id: {
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

        create_user: {
          rest: 'POST /',
          roles: ['admin'],
          params: {
            name: 'string',
            country_code: {
              type: 'string',
              optional: true,
              default: '+86',
            },
            phone: 'string',
            password: 'string',
          },
          handler: this.create_user,
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

        findOrCreateByDamaiId: {
          visibility: 'protected',
          params: {
            damai_user_id: 'string',
            name: 'string',
          },
          handler: this.findOrCreateByDamaiId,
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

  async wechat_bind_phone(
    ctx: Context<{ code: string }, { user: UserMeta; $statusCode?: number }>
  ) {
    const { code } = ctx.params;
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const wechatConfig = await this.getWechatConfig();

    const { access_token } = await ctx.call<{ access_token: string }>('wechat.access_token');
    const phoneInfo = await getWechatUserPhoneNumber(
      wechatConfig,
      access_token,
      code,
    );

    const country_code = phoneInfo.countryCode.startsWith('+')
      ? phoneInfo.countryCode
      : `+${phoneInfo.countryCode}`;

    await bindPhoneToUser(
      this.pool,
      schema,
      uid,
      country_code,
      phoneInfo.purePhoneNumber,
    ).catch(handleUserError);

    ctx.meta.$statusCode = 204;
    return null;
  }

  async profile(ctx: Context<void, { user: UserMeta }>) {
    const { uid } = ctx.meta.user;
    const client = this.pool;
    const schema = await this.getSchema();

    const profile = await getUserProfile(client, schema, uid)
      .then(res => res, handleUserError);

    return profile;
  }

  async profile_update(
    ctx: Context<{
      name?: string;
      avatar?: string;
      profile?: Record<string, unknown>;
    }, { user: UserMeta; $statusCode?: number }>,
  ) {
    const { uid } = ctx.meta.user;
    const schema = await this.getSchema();
    const { name, avatar, profile } = ctx.params;

    await updateUserProfile(this.pool, schema, uid, {
      name,
      avatar,
      profile,
    }).catch(handleUserError);

    ctx.meta.$statusCode = 204;
    return null;
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

  async list(
    ctx: Context<{
      phone?: string;
      damai_user_id?: string;
      page?: number;
      limit?: number
    }>
  ) {
    const schema = await this.getSchema();
    const { phone, damai_user_id, page = 1, limit = 20 } = ctx.params;

    const users = await listUserProfiles(
      this.pool, schema,
      { phone, damai_user_id, page, limit }
    );
    return users;
  }

  async create_user(
    ctx: Context<
      {
        name: string;
        country_code?: string;
        phone: string;
        password: string;
      },
      { $statusCode?: number }
    >,
  ) {
    const schema = await this.getSchema();
    const {
      name,
      country_code = '+86',
      phone,
      password,
    } = ctx.params;

    const uid = await createUserByPhonePassword(this.pool, schema, {
      name,
      country_code,
      phone,
      password,
    }).catch(handleUserError);

    const userProfile = await getUserProfile(this.pool, schema, uid)
      .then(res => res, handleUserError);

    ctx.meta.$statusCode = 201;
    return userProfile;
  }

  async list_roles() {
    const schema = await this.getSchema();
    return listRoles(this.pool, schema);
  }

  async create_role(
    ctx: Context<{ name: string; description?: string; permissions?: string[] }>
  ) {
    const schema = await this.getSchema();
    const { name, description, permissions } = ctx.params;

    return createRole(this.pool, schema, {
      name,
      description,
      permissions,
    }).catch(handleUserError);
  }

  async delete_role(
    ctx: Context<{ role_id: string }, { $statusCode?: number }>
  ) {
    const schema = await this.getSchema();
    const { role_id } = ctx.params;

    await deleteRoleById(this.pool, schema, role_id).catch(handleUserError);

    ctx.meta.$statusCode = 204;
    return null;
  }

  async findOrCreateByPhone(
    ctx: Context<{ country_code: string; phone: string; name: string }>
  ) {
    const { country_code, phone, name } = ctx.params;
    const schema = await this.getSchema();
    const uid = await upsertUserByPhone(this.pool, schema, country_code, phone, name);
    return uid;
  }

  async findOrCreateByDamaiId(
    ctx: Context<{ damai_user_id: string; name: string }>
  ) {
    const { damai_user_id, name } = ctx.params;
    const schema = await this.getSchema();
    const uid = await upsertUserByDamaiId(this.pool, schema, damai_user_id, name);
    return uid;
  }
}
