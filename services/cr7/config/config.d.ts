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
    }
  }

  const config: IConfig;
  export default config;
}