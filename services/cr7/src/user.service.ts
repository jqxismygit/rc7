import { Context, Service } from "moleculer"
import { Pool } from "pg";
import { jscode2session } from "./libs/wechat.js";
import { createOrUpdateUser, getUserProfile } from "./data/user.js";
import { handleUserError } from "./libs/errors.js";

interface UserMeta {
  uid: string;
}

export default class UserService extends Service {
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

  async getSchema() {
    const { default: config } = await import('config');
    return config.pg.schema;
  }

  async getWechatConfig() {
    const { default: config } = await import('config');
    return config.wechat;
  }
};
