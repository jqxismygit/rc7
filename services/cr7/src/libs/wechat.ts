import { getJSON } from "./fetch-utils.js";

interface WechatConfig {
  base_url: string;
  appid: string;
  secret: string;
}

interface WechatErrorResponse {
  errcode: number;
  errmsg: string;
}

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

interface Jscode2SessionSuccess {
  openid: string;
  session_key: string;
}

type Jscode2SessionResponse =
| Jscode2SessionSuccess
| WechatErrorResponse;

export async function jscode2session(
  wechatConfig: WechatConfig, js_code: string
): Promise<Jscode2SessionSuccess> {
  const { base_url, appid, secret } = wechatConfig;
  const res = await getJSON<string>(
    `${base_url}/sns/jscode2session`,
    { query: { appid, secret, js_code, grant_type: 'authorization_code' } }
  );

  const parsed_res = JSON.parse(res) as Jscode2SessionResponse;
  if ('errcode' in parsed_res) {
    throw new WechatError(parsed_res);
  }

  return parsed_res as Jscode2SessionSuccess;
}