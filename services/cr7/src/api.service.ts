import type { ServiceSchema } from 'moleculer';
import type { ApiRouteSchema } from 'moleculer-web';
import ApiService from 'moleculer-web';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
import config from 'config';
import * as DateFns from 'date-fns';

const {
  UnAuthorizedError,
  ERR_INVALID_TOKEN, ERR_NO_TOKEN
} = ApiService.Errors;

export function signToken(
  payload: Record<string, unknown>, tokenExpiresIn?: string | number
) {
  const options = Object.assign(
    {}, config.jwt.options,
    tokenExpiresIn ? { expiresIn: tokenExpiresIn } : {}
  );

  const tokenPayload = _.cloneDeep(payload);
  const token = jwt.sign(tokenPayload, config.jwt.secret, options);
  return { token };
}


const onAfterCall: ApiRouteSchema['onAfterCall'] = async function onAfterCall(
  ctx, route, req, res, data
) {
  if (Object.hasOwnProperty.call(data ?? {}, 'token')) {
    const { token: payload, ...rest } = data;
    const { token } = signToken(payload);
    return Object.assign(rest, { token });
  }

  return data;
}

const onBeforeCall: ApiRouteSchema['onBeforeCall'] = function onBeforeCall(
  ctx, route, req, _res
) {
  const forwardedFor = req.headers['x-forwarded-for'] ?? null;
  const realIp = req.headers['x-real-ip'] ?? null;
  const remoteAddress = req.socket.remoteAddress;
  const ipAddress = forwardedFor ?? realIp ?? remoteAddress;

  const userAgent = req.headers['user-agent'] || null;
  const referrer = req.headers['referer'] || null;

  Object.assign(ctx.meta, { ipAddress, userAgent, referrer, headers: req.headers });
}

function routeConfig(
  path: string, actions: string[],
  overrides: Partial<ApiRouteSchema> = {}
) {
  return Object.assign(
    {
      authentication: true,
      authorization: true,
      autoAliases: false,
      mappingPolicy: 'restrict',
      bodyParser: { json: true, urlencoded: false },
      onBeforeCall,
      onAfterCall,
    },
    overrides,
    { path, whitelist: ([] as string[]).concat(actions) }
  ) satisfies ApiRouteSchema;
}

const routes = [
  routeConfig(
    '/',
    [
      '$node.*', 'api.*',
      'user.wechat_mini_login',
      'user.password_login'
    ],
    {
      authorization: false,
      aliases: {
        'GET  /services': '$node.services',
        'GET  /nodes':    '$node.list',
        'GET  /aliases':  'api.listAliases',

        'POST /user/login/wechat/mini': 'user.wechat_mini_login',
        'POST /user/login/password': 'user.password_login'
      }
    },
  ),
  routeConfig(
    '/user',
    [
      'user.roles',
      'user.profile',
      'user.profile_update',
      'user.password_update',
      'user.su',
      'user.wechat_bind_phone'
    ],
    {
      aliases: {
        'GET /roles': 'user.roles',
        'GET /profile': 'user.profile',
        'PUT /profile': 'user.profile_update',
        'PUT /password': 'user.password_update',
        'POST /su': 'user.su',
        'POST /phone/wechat': 'user.wechat_bind_phone',
      }
    }
  ),
  routeConfig(
    '/users',
    [
      'user.grant_role', 'user.revoke_role', 'user.list', 'user.create_user',
      'user.list_roles', 'user.create_role', 'user.delete_role', 'user.update_role'
    ],
    {
      aliases: {
        'GET /': 'user.list',
        'POST /': 'user.create_user',
        'POST /:uid/roles': 'user.grant_role',
        'DELETE /:uid/roles/:role_id': 'user.revoke_role',
        'GET /roles': 'user.list_roles',
        'POST /roles': 'user.create_role',
        'DELETE /roles/:role_id': 'user.delete_role',
        'PATCH /roles/:role_id': 'user.update_role',
      }
    }
  ),
  routeConfig(
    '/exhibition',
    [
      'cr7.exhibition.*',
      'xiecheng.bindXiechengOptionId',
      'xiecheng.syncXiechengPrice',
      'xiecheng.syncXiechengInventory',
      'xiecheng.listXiechengSyncLogs',
      'mop.syncExhibitionToMop',
      'mop.syncSessionsToMop',
      'mop.syncTicketsToMop',
      'mop.syncStocksToMop',
      'damai.syncExhibitionToDamai',
      'damai.syncSessionsToDamai',
      'damai.syncTicketsToDamai',
    ],
    {
      autoAliases: true,
      aliases: {
        'PUT /:eid/tickets/:tid/ota/xc': 'xiecheng.bindXiechengOptionId',
        'POST /:eid/tickets/:tid/ota/xc/sync/prices': 'xiecheng.syncXiechengPrice',
        'POST /:eid/tickets/:tid/ota/xc/sync/inventory': 'xiecheng.syncXiechengInventory',
        'GET /:eid/tickets/:tid/ota/xc/sync/logs': 'xiecheng.listXiechengSyncLogs',
        'POST /:eid/ota/mop/sync': 'mop.syncExhibitionToMop',
        'POST /:eid/ota/mop/sync/sessions': 'mop.syncSessionsToMop',
        'POST /:eid/ota/mop/sync/tickets': 'mop.syncTicketsToMop',
        'POST /:eid/ota/mop/sync/stocks': 'mop.syncStocksToMop',
        'POST /:eid/ota/damai/sync': 'damai.syncExhibitionToDamai',
        'POST /:eid/ota/damai/sync/sessions': 'damai.syncSessionsToDamai',
        'POST /:eid/sessions/:sid/ota/damai/sync/tickets': 'damai.syncTicketsToDamai',
      },
    }
  ),
  routeConfig(
    '/exhibition/:eid/sessions/:sid/orders',
    ['cr7.order.createWithWechatPay'],
    {
      aliases: {
        'POST /': 'cr7.order.createWithWechatPay'
      }
    }
  ),
  routeConfig(
    '/orders',
    [
      'cr7.order.get', 'cr7.order.list', 'cr7.order.cancel',
      'cr7.order.hide', 'cr7.invoice.applyFapiao', 'cr7.invoice.listFapiaoApplications',
      'cr7.order.wechatpay', 'cr7.order.refund', 'cr7.redemption.getByOrder'
    ],
    {
      aliases: {
        'GET /:oid/redemption': 'cr7.redemption.getByOrder',
      },
      autoAliases: true,
    }
  ),
  routeConfig(
    '/admin/orders',
    ['cr7.order.listAdmin', 'cr7.order.getAdmin', 'cr7.order.refundsAdmin'],
    {
      autoAliases: true,
    }
  ),
  routeConfig(
    '/exhibition/:eid/redeem', ['cr7.redemption.redeem'], {
      aliases: {
        'POST /': 'cr7.redemption.redeem'
      }
    }
  ),
  routeConfig(
    '/payment',
    ['cr7.wechatpay.callback', 'cr7.wechatpay.refundCallback'],
    {
      authentication: false,
      authorization: false,
      aliases: {
        'POST /wechat/callback': 'cr7.wechatpay.callback',
        'POST /wechat/callback/refund': 'cr7.wechatpay.refundCallback',
      }
    }
  ),
  routeConfig(
    '/ota/ctrip/callback',
    ['xiecheng.receiveCtripCallback'],
    {
      authentication: false,
      authorization: false,
      aliases: {
        'POST /': 'xiecheng.receiveCtripCallback',
      }
    }
  ),
  routeConfig(
    '/ota/ctrip',
    ['xiecheng.getCtripOrderRecord', 'xiecheng.listCtripOrderRecords'],
    {
      aliases: {
        'GET /orders': 'xiecheng.listCtripOrderRecords',
        'GET /orders/:rid': 'xiecheng.getCtripOrderRecord',
      }
    }
  ),
  routeConfig(
    '/ota/mop',
    ['mop.getMopOrderRecord'],
    {
      aliases: {
        'GET /orders/:rid': 'mop.getMopOrderRecord',
      }
    }
  ),
  routeConfig(
    '/ota/damai',
    ['damai.createOrderFromDamai', 'damai.payOrderFromDamai', 'damai.cancelOrderFromDamai', 'damai.refundApplyFromDamai', 'damai.getETicketInfoFromDamai'],
    {
      authentication: false,
      authorization: false,
      aliases: {
        'POST /createOrder': 'damai.createOrderFromDamai',
        'POST /payCallBack': 'damai.payOrderFromDamai',
        'POST /cancelOrder': 'damai.cancelOrderFromDamai',
        'POST /refundApply': 'damai.refundApplyFromDamai',
        'POST /getSeatInfo': 'damai.getETicketInfoFromDamai',
      },
    }
  ),
  routeConfig(
    '/ota/damai/orders',
    ['damai.getDamaiOrderRecord'],
    {
      aliases: {
        'GET /:rid': 'damai.getDamaiOrderRecord',
      }
    }
  ),
  routeConfig(
    '/mop',
    [
      'mop.receiveOrderFromMop',
      'mop.queryOrderFromMop',
      'mop.receiveTicketFromMop',
      'mop.receiveOrderStatusChangeFromMop',
    ],
    {
      authentication: false,
      authorization: false,
      aliases: {
        'POST /order': 'mop.receiveOrderFromMop',
        'POST /orderQuery': 'mop.queryOrderFromMop',
        'POST /ticket': 'mop.receiveTicketFromMop',
        'POST /orderStatusChange': 'mop.receiveOrderStatusChangeFromMop',
      },
    }
  ),
  routeConfig(
    '/topics',
    [
      'cr7.topics.create',
      'cr7.topics.update',
      'cr7.topics.delete',
      'cr7.topics.createArticle',
      'cr7.topics.reorderArticles',
      'cr7.topics.list',
      'cr7.topics.get',
    ],
    {
      autoAliases: true,
    }
  ),
  routeConfig(
    '/articles',
    [
      'cr7.topics.updateArticle',
      'cr7.topics.deleteArticle',
      'cr7.topics.getArticle',
    ],
    {
      autoAliases: true,
    }
  ),
  routeConfig(
    '/assets',
    ['cr7.assets.uploadImage', 'cr7.assets.uploadVideo'],
    {
      aliases: {
        'POST /images': {
          type: 'stream',
          action: 'cr7.assets.uploadImage',
        },
        'POST /videos': {
          type: 'stream',
          action: 'cr7.assets.uploadVideo',
        },
      }
    }
  ),
]

export default {
  name: 'api',
  mixins: [ApiService],
  settings: Object.assign({ etag: true, }, config.api, { routes }),

  methods: {
    signToken,

    async authenticate(ctx, route, req) {
      let tokenString = null;
      const authHeader = req.headers['authorization'] ?? null;

      if (authHeader !== null) {
        if ((authHeader.startsWith('Bearer ') ?? false) === false) {
          return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, 'Invalid authorization header format'));
        }
        tokenString = authHeader.slice(7);
      }

      const accessToken = req['$params'].accessToken ?? null;
      tokenString = tokenString ?? accessToken;

      if (tokenString === null) {
        return Promise.resolve(null);
      }

      let decoded = null;
      try {
        const jwtOptions = config.jwt.options;
        decoded = jwt.verify(tokenString, config.jwt.secret, jwtOptions as jwt.VerifyOptions);
      } catch (error) {
        return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, (error as Error).message));
      }

      decoded = decoded as { uid?: string; exp?: number; iat: number };
      const { uid = null, exp = null, iat } = decoded;
      if (!exp) {
        const signAt = DateFns.fromUnixTime(iat);
        const expiredAt = DateFns.addDays(signAt, config.jwt.options.expiresIn);
        if (DateFns.isAfter(new Date(), expiredAt)) {
          return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, 'Token has expired'));
        }
      }

      if ((uid ?? null) === null) {
        return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, 'Invalid token: missing uid'));
      }

      const user = { ...decoded, uid };
      return user;
    },

    authorize(ctx) {
      if ((ctx.meta.user ?? null) === null) {
        return Promise.reject(new UnAuthorizedError(ERR_NO_TOKEN, 'No token provided'));
      }
    },
  }
} as ServiceSchema;