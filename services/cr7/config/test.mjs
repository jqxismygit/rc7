import path from 'node:path';
import os from 'node:os';
import { URL } from 'node:url';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const fixtures_path = path.resolve(__dirname, '../tests/fixtures');

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
  assets: {
    path: path.resolve(os.tmpdir(), 'cr7_test_assets'),
  },
  wechat: {
    base_url: 'https://1.1.1.1',
    appid: 'test_appid',
    secret: 'test_secret',
  },
  wechatpay: {
    base_url: 'https://1.1.1.1',
    callback_base_url: 'https://1.1.1.1/api',
    client_key_path: path.resolve(fixtures_path, 'wechatpay/apiclient_key.pem'),
  },
  xiecheng: {
    base_url: 'https://1.1.1.1',
    callback_base_url: 'https://1.1.1.1',
    account_id: 'test_account_id',
    secret: 'test_sign_secret',
    aes_key: '1234567890abcdef',
    aes_iv: 'abcdef1234567890',
  },
  mop: {
    base_url: 'https://1.1.1.1',
    aes_key: '1234567890abcdef',
    supplier: 'TEST_MOP_SUPPLIER',
  },
  damai: {
    base_url: 'https://1.1.1.1',
  }
}