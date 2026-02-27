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
      appId: string;
      appSecret: string;
    }
  }

  const config: IConfig;
  export default config;
}