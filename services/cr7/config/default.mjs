export default {
  broker: {
    logger: true,
    hotReload: true,
    nodeID: 'cr7',
    transporter: {
      type: 'TCP',
      options: {
        udpDiscovery: true,
        port: 50004,
      }
    }
  },
  api: {
    port: 5004
  },
  jwt: {
    secret: '__JWT_SECRET__',
    options: {
      expiresIn: '7d',
    }
  },
  pg: {
    host: 'localhost',
    port: 5432,
    user: 'cr7',
    password: 'cr7',
    database: 'cr7',
    schema: 'cr7'
  },
  wechat: {
    base_url: 'https://api.weixin.qq.com',
    appid: 'wx8e0cd522cf168035',
    secret: '__APP_SECRET__',
  }
}