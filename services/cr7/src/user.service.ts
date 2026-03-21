import { Context, Errors, Service } from 'moleculer';
import { Pool } from 'pg';
import { jscode2session } from './libs/wechat.js';
import {
  createOrUpdateUser,
  getUserProfile,
  loginByPhonePassword,
  updatePassword,
} from './data/user.js';
import { handleUserError } from './libs/errors.js';

interface UserMeta {
  uid: string;
}

const { MoleculerClientError } = Errors;

export default class UserService extends Service {
  pool!: Pool;

  constructor(broker) {
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
        }
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

  async getSchema() {
    const { default: config } = await import('config');
    return config.pg.schema;
  }

  async getWechatConfig() {
    const { default: config } = await import('config');
    return config.wechat;
  }
}
