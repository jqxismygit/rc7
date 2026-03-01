export default {
  broker: {
    logger: true,
    hotReload: true,
    nodeID: 'rc7',
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
    user: 'rc7',
    password: 'rc7',
    database: 'rc7',
    schema: 'rc7'
  },
  wechat: {
    base_url: 'https://api.weixin.qq.com',
    appid: 'wx8e0cd522cf168035',
    secret: '__APP_SECRET__',
  }
}