import { Errors, Service, ServiceBroker } from 'moleculer';
import { getWechatAccessToken } from './libs/wechat.js';

const { MoleculerError } = Errors;

interface WechatTokenState {
  access_token: string;
  expires_in: number;
  expires_at: number;
}

interface WechatConfig {
  base_url: string;
  appid: string;
  secret: string;
}

const REFRESH_BEFORE_EXPIRES_SECONDS = 1200;
const RETRY_ON_ERROR_MS = 5000;

export default class WechatService extends Service {
  refreshTimer?: NodeJS.Timeout;
  tokenState?: WechatTokenState;
  tokenRequest?: Promise<WechatTokenState>;

  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'wechat',
      actions: {
        access_token: {
          handler: this.accessToken,
        },
      },
      started() {
        void this.ensureToken();
      },
      async stopped() {
        this.clearRefreshTimer();
      },
    });
  }

  clearRefreshTimer() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  scheduleRefresh(expiresInSeconds: number) {
    this.clearRefreshTimer();

    const refreshInSeconds = Math.max(1, expiresInSeconds - REFRESH_BEFORE_EXPIRES_SECONDS);
    this.refreshTimer = setTimeout(() => {
      void this.refreshToken();
    }, refreshInSeconds * 1000);
  }

  async getWechatConfig() {
    const { default: config } = await import('config');
    const settingsWechat = (this.settings as { wechat?: Partial<WechatConfig> }).wechat;
    return {
      ...config.wechat,
      ...settingsWechat,
    };
  }

  async refreshToken() {
    if (this.tokenRequest) {
      return this.tokenRequest;
    }

    this.tokenRequest = (async () => {
      try {
        const wechatConfig = await this.getWechatConfig();
        const token = await getWechatAccessToken(wechatConfig);
        const expires_at = Date.now() + token.expires_in * 1000;

        const state: WechatTokenState = {
          access_token: token.access_token,
          expires_in: token.expires_in,
          expires_at,
        };

        this.tokenState = state;
        this.scheduleRefresh(token.expires_in);
        return state;
      } catch (error) {
        this.logger.error('refresh wechat access_token failed', error);
        this.clearRefreshTimer();
        this.refreshTimer = setTimeout(() => {
          void this.refreshToken();
        }, RETRY_ON_ERROR_MS);
        throw error;
      } finally {
        this.tokenRequest = undefined;
      }
    })();

    return this.tokenRequest;
  }

  async ensureToken() {
    const state = this.tokenState;
    if (state && Date.now() < state.expires_at) {
      return state;
    }

    return this.refreshToken();
  }

  async accessToken() {
    const state = await this.ensureToken().catch((error: unknown) => {
      throw new MoleculerError(
        '获取微信 access_token 失败',
        503,
        'WECHAT_ACCESS_TOKEN_UNAVAILABLE',
        { cause: error }
      );
    });

    return {
      access_token: state.access_token,
      expires_in: state.expires_in,
    };
  }
}
