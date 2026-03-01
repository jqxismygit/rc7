import { ServiceSchema } from "moleculer"
import { Pool } from "pg";
import { jscode2session } from "./libs/wechat.js";
import { createOrUpdateUser, getUserProfile } from "./model/user.js";

const actions: ServiceSchema['actions'] = {
  wechat_mini_login: {
    rest: 'POST /login/wechat/mini',
    params: {
      code: 'string'
    },
    async handler(ctx) {
      const { code } = ctx.params;
      const client = this.pool;
      const wechatConfig = await this.getWechatConfig();

      // 调用微信接口获取 openid 和 session_key
      const wechatResult = await jscode2session(wechatConfig, code);
      const { openid, session_key } = wechatResult;

      const user = await createOrUpdateUser(client, openid, session_key);

      return { token: { uid: user.id } };
    }
  },

  profile: {
    rest: 'GET /profile',
    async handler(ctx) {
      const { uid } = ctx.meta.user;
      const client = this.pool;

      const profile = await getUserProfile(client, uid);
      return profile;
    }
  }
};

const methods: ServiceSchema['methods'] = {
  async getWechatConfig() {
    const { default: config } = await import('config');
    return config.wechat;
  }
}

export default {
  name: 'user',
  settings: {
    rest: '/users',
    $noVersionPrefix: true,
  },

  actions,
  methods,

  async started() {
    const { default: config } = await import('config');
    this.pool = new Pool(config.pg);
  },

  async stopped() {
    await this.pool.end();
  }
} as ServiceSchema;