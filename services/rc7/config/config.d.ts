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
    }
  }

  const config: IConfig;
  export default config;
}