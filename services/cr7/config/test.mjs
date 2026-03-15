export default {
  api: {
    port: 0
  },
  pg: {
    database: 'cr7_test',
  },
  broker: {
    namespace: 'cr7-test',
    logger: {
      type: 'Console',
      options: {
        level: 'error'
      }
    },
    hotReload: false,
    nodeID: 'cr7-test',
    transporter: {
      type: 'TCP',
      options: {
        udpDiscovery: true,
        port: 0,
      }
    }
  },
  wechat: {
    base_url: 'https://1.1.1.1',
    appid: 'test_appid',
    secret: 'test_secret',
  }
}