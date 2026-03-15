import type { ServiceSchema } from 'moleculer';
import type { ApiRouteSchema } from 'moleculer-web';
import ApiService from 'moleculer-web';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
import config from 'config';
import * as DateFns from 'date-fns';

const {
  UnAuthorizedError, ForbiddenError,
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

  Object.assign(ctx.meta, { ipAddress, userAgent, referrer });
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
    { path, whitelist: [].concat(actions) }
  ) satisfies ApiRouteSchema;
}

const routes = [
  routeConfig(
    '/',
    [
      '$node.*', 'api.*',
      'user.wechat_mini_login'
    ],
    {
      authorization: false,
      aliases: {
        'GET  /services': '$node.services',
        'GET  /nodes':    '$node.list',
        'GET  /aliases':  'api.listAliases',

        'POST /user/login/wechat/mini': 'user.wechat_mini_login'
      }
    },
  ),
  routeConfig(
    '/user',
    ['user.profile'],
    {
      aliases: {
        'GET /profile': 'user.profile'
      }
    }
  ),
  routeConfig(
    '/exhibition',
    ['cr7.exhibition.*'],
    {
      authorization: false,
      autoAliases: true,
    }
  )
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
        decoded = jwt.verify(tokenString, config.jwt.secret, config.jwt.options);
      } catch (error) {
        decoded = jwt.decode(tokenString, config.jwt.secret, config.jwt.options);
        return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, error.message));
      }

      const scope = decoded.scope ?? null;
      // accessToken 必须有特定的 scope
      if (accessToken !== null && scope === null) {
        return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, 'accessToken requires scope'));
      }

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

      const user = { ...decoded, uid, scope };
      const userProfile = await ctx.call('user.profile', {}, { meta: { user } })
      .catch(error => {
        return Promise.reject(new UnAuthorizedError(ERR_INVALID_TOKEN, error.message));
      });
      const { email } = userProfile;
      Object.assign(user, { email });
      return user;
    },

    authorize(ctx, router, req) {
      if ((ctx.meta.user ?? null) === null) {
        return Promise.reject(new UnAuthorizedError(ERR_NO_TOKEN, 'No token provided'));
      }

      const { scope } = ctx.meta.user;

      // 有 scope 时，需要应用到指定接口上
      if (scope !== null && scope !== req['$action'].name) {
        return Promise.reject(new ForbiddenError('ERR_INSUFFICIENT_SCOPE', 'Insufficient scope'));
      }
    },

    ops_authorize: async function (ctx, route, req) {
      const user = ctx.meta.user ?? null;
      if (user === null) {
        return Promise.reject(new UnAuthorizedError(ERR_NO_TOKEN, 'No token provided'));
      }
      const opsProfile = await ctx.call(
        'ops.user_profile', {}, { meta: { user } }
      );
      if (opsProfile.roles.length === 0) {
        return Promise.reject(new ForbiddenError('ERR_INSUFFICIENT_SCOPE', 'Insufficient scope'));
      }
      return this.authorize(ctx, route, req);
    }
  }
} as ServiceSchema;