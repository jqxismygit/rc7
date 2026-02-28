import { ServiceSchema } from "moleculer"
import { Pool } from "pg";
import config from "config";

const actions: ServiceSchema['actions'] = {
  wechat_mini_login: {
    rest: 'POST /login/wechat/mini',
    params: {
      code: 'string'
    },
    async handler(_ctx) {
    }
  }
};

const methods: ServiceSchema['methods'] = {

}

export default {
  name: 'user',
  settings: {
    rest: '/users',
    $noVersionPrefix: true,
  },

  actions,
  methods,

  started() {
    this.pool = new Pool(config.pg);
  },

  async stopped() {
    await this.pool.end();
  }
} as ServiceSchema;