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
  pg: {
    host: 'localhost',
    port: 5432,
    user: 'rc7',
    password: 'rc7',
    database: 'rc7',
    schema: 'rc7'
  }
}