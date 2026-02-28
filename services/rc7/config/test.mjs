export default {
  api: {
    port: 0
  },
  broker: {
    namespace: 'rc7-test',
    logger: {
      type: 'Console',
      options: {
        level: 'error'
      }
    },
    hotReload: false,
    nodeID: 'rc7-test',
    transporter: {
      type: 'TCP',
      options: {
        udpDiscovery: true,
        port: 0,
      }
    }
  }
}