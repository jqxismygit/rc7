import { getJSON, postJSON } from './fetch-utils.js';

interface WechatServiceConfig {
  base_url: string;
  appid: string;
  secret: string;
  service_url: string;
}

interface Jscode2SessionSuccess {
  openid: string;
  session_key: string;
}

interface AccessTokenSuccess {
  access_token: string;
  expires_in: number;
}

interface WechatErrorResponse {
  errcode: number;
  errmsg: string;
}

type Jscode2SessionResponse = Jscode2SessionSuccess | WechatErrorResponse;

interface PhoneInfo {
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode: string;
}

interface GetUserPhoneNumberSuccess {
  errcode: 0;
  errmsg: 'ok';
  phone_info: PhoneInfo;
}

type GetUserPhoneNumberResponse = GetUserPhoneNumberSuccess | WechatErrorResponse;

export class WechatError extends Error {
  errcode: number;
  errmsg: string;

  constructor(response: WechatErrorResponse) {
    const { errcode, errmsg } = response;
    super(`Wechat API Error ${errcode}: ${errmsg}`);
    this.errcode = errcode;
    this.errmsg = errmsg;
  }
}

export async function jscode2session(
  wechatConfig: WechatServiceConfig,
  js_code: string,
): Promise<Jscode2SessionSuccess> {
  const { base_url, appid, secret } = wechatConfig;
  const raw = await getJSON<string | Jscode2SessionResponse>(
    `${base_url}/sns/jscode2session`,
    { query: { appid, secret, js_code, grant_type: 'authorization_code' } },
  );

  const res = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Jscode2SessionResponse;
  if ('errcode' in res) {
    throw new WechatError(res);
  }

  return res;
}

export async function getWechatAccessToken(
  wechatConfig: WechatServiceConfig,
): Promise<AccessTokenSuccess> {
  const res = await getJSON<AccessTokenSuccess>(
    `${wechatConfig.service_url}/access_token`
  );
  return res;
}

export async function getWechatUserPhoneNumber(
  wechatConfig: WechatServiceConfig,
  code: string,
): Promise<PhoneInfo> {
  const { base_url } = wechatConfig;
  const { access_token } = await getWechatAccessToken(wechatConfig);

  const raw = await postJSON<GetUserPhoneNumberResponse | string>(
    `${base_url}/wxa/business/getuserphonenumber?access_token=${access_token}`,
    { body: { code } },
  );

  const res = (typeof raw === 'string' ? JSON.parse(raw) : raw) as GetUserPhoneNumberResponse;
  if ('errcode' in res && res.errcode !== 0) {
    throw new WechatError(res);
  }

  return (res as GetUserPhoneNumberSuccess).phone_info;
}