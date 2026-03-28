declare module 'config' {
  interface IConfig {
    api: {
      port: number;
    },
    jwt: {
      secret: string;
      options: {
        expiresIn: number;
      }
    },
    broker: {
      nodeID: string;
      hotReload: boolean;
      transporter: {
        type: string;
        options: Record<string, unknown>;
      }
    },
    pg: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      schema: string;
    },
    wechat: {
      base_url: string;
      appid: string;
      secret: string;
    },
    wechatpay: {
      base_url: string;
      appid: string;
      mchid: string;
      // APIv3密钥
      api_v3_secret: string;
      // 商户API私钥序列号
      client_key_serial_no: string;
      // 商户API私钥路径
      client_key_path: string;
      // 微信支付公钥id
      wechat_pay_serial: string;
      // 微信支付公钥路径
      wechat_pay_public_key_path: string;
      callback_base_url: string;
    },
    xiecheng: {
      callback_base_url: string;
      base_url: string;
      account_id: string;
      secret: string;
      aes_key: string;
      aes_iv: string;
    }
  }

  const config: IConfig;
  export default config;
}