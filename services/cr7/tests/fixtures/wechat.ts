import { Server } from 'node:http';
import { User } from '@cr7/types';
import { vi } from 'vitest';
import { random_text } from '../lib/random.js';
import { mockJSONServer, mockWechatServer } from '../lib/server.js';
import { getUserProfile, wechatBindPhone, wechatMiniLogin } from './user.js';

type MiniLoginResponse = {
  openid: string;
  session_key: string;
};

type PhoneInfo = {
  countryCode: string;
  purePhoneNumber: string;
  phoneNumber: string;
};

type BindPhoneOptions = {
  countryCode?: string;
  phone?: string;
};

export interface WechatFixture {
  close: () => Promise<void>;
  mockMiniLoginCode: (code: string, response?: Partial<MiniLoginResponse>) => MiniLoginResponse;
  mockPhoneBindCode: (code: string, options?: BindPhoneOptions) => PhoneInfo;
  registerAndBindPhone: (
    apiServer: Server,
    userName?: string,
    options?: BindPhoneOptions,
  ) => Promise<{
    token: string;
    profile: User.Profile;
    openid: string;
    phone: string;
    countryCode: string;
  }>;
}

function normalizeCountryCode(countryCode: string) {
  return countryCode.startsWith('+') ? countryCode.slice(1) : countryCode;
}

function randomPhone() {
  return `13${Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0')}`;
}

export async function setupWechatFixture(): Promise<WechatFixture> {
  const miniLoginCodes = new Map<string, MiniLoginResponse>();
  const phoneBindCodes = new Map<string, PhoneInfo>();

  const mockWechatReqHandler = vi.fn(async ({ path, query, body }: {
    path: string;
    query: Record<string, string>;
    body: unknown;
  }) => {
    if (path === '/sns/jscode2session') {
      const code = query.js_code;
      if (!code) {
        throw new Error('code is required');
      }

      const response = miniLoginCodes.get(code);
      if (!response) {
        throw new Error(`missing mini login mock for code: ${code}`);
      }

      return response;
    }

    if (path === '/wxa/business/getuserphonenumber') {
      const bindCode = (body as { code?: string } | null)?.code;
      if (!bindCode) {
        throw new Error('phone bind code is required');
      }

      const phoneInfo = phoneBindCodes.get(bindCode);
      if (!phoneInfo) {
        throw new Error(`missing phone bind mock for code: ${bindCode}`);
      }

      return {
        errcode: 0,
        errmsg: 'ok',
        phone_info: phoneInfo,
      };
    }

    throw new Error(`Unexpected request to mock wechat server with path: ${path}`);
  });

  const server = await mockWechatServer(mockWechatReqHandler);
  const accessTokenServer = await mockJSONServer(async ({ path }) => {
    if (path !== '/access_token') {
      throw new Error(`Unexpected request to mock access token server with path: ${path}`);
    }

    return {
      access_token: 'mock_access_token',
      expires_in: 7200,
    };
  });
  const { default: runtimeConfig } = await import('config');
  const baseUrlSpy = vi
    .spyOn(runtimeConfig.wechat, 'base_url', 'get')
    .mockReturnValue(server.address);
  const serviceUrlSpy = vi
    .spyOn(runtimeConfig.wechat, 'service_url', 'get')
    .mockReturnValue(accessTokenServer.address);

  const mockMiniLoginCode = (code: string, response: Partial<MiniLoginResponse> = {}) => {
    const res: MiniLoginResponse = {
      openid: response.openid ?? `openid_${code}`,
      session_key: response.session_key ?? `session_key_${code}`,
    };
    miniLoginCodes.set(code, res);
    return res;
  };

  const mockPhoneBindCode = (code: string, options: BindPhoneOptions = {}) => {
    const purePhoneNumber = options.phone ?? randomPhone();
    const countryCode = normalizeCountryCode(options.countryCode ?? '86');
    const phoneInfo: PhoneInfo = {
      countryCode,
      purePhoneNumber,
      phoneNumber: `+${countryCode}${purePhoneNumber}`,
    };
    phoneBindCodes.set(code, phoneInfo);
    return phoneInfo;
  };

  return {
    async close() {
      serviceUrlSpy.mockRestore();
      baseUrlSpy.mockRestore();
      await accessTokenServer.close();
      await server.close();
    },
    mockMiniLoginCode,
    mockPhoneBindCode,
    async registerAndBindPhone(apiServer, userName = random_text(8), options = {}) {
      const loginCode = `login_code_${userName}_${random_text(6)}`;
      const loginResponse = mockMiniLoginCode(loginCode, {
        openid: `openid_${userName}`,
        session_key: `session_key_${userName}`,
      });

      const { token } = await wechatMiniLogin(apiServer, loginCode);

      const bindCode = `phone_bind_code_${userName}_${random_text(6)}`;
      const phoneInfo = mockPhoneBindCode(bindCode, options);
      await wechatBindPhone(apiServer, token, bindCode);

      const profile = await getUserProfile(apiServer, token);
      return {
        token,
        profile,
        openid: loginResponse.openid,
        phone: phoneInfo.purePhoneNumber,
        countryCode: phoneInfo.countryCode,
      };
    },
  };
}
