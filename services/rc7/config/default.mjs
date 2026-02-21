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
  }
}