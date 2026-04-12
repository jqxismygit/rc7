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
    service_url: 'http://127.0.0.1:3000',
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
    public_key_path: path.resolve(fixtures_path, 'mop/public_key.cer'),
    private_key_path: path.resolve(fixtures_path, 'mop/private_key.cer'),
  },
  damai: {
    base_url: 'https://1.1.1.1',
  },
  fapiao: {
    app_id: 'test_fapiao_app_id',
    secret: '80AB94991453FA0D',
    base_url: 'https://1.1.1.1',
    callback_base_url: 'https://test.example.com/api/fapiao/callback',
    tax_id: '110109500321668',
    company_name: '测试销售方公司',
    company_address: '测试销售方地址',
    company_phone: '010-1008611',
    company_bank: '测试银行北京分行',
    company_bank_account: '6222020202020202020',
    issuer: '测试开票员',
  }
}