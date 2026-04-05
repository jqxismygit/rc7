import path from 'node:path';
import { URL } from 'node:url';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const etc_path = path.resolve(__dirname, '../../../etc');
const host = 'https://dev.cr7life.cn';

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
    port: 5026,
  },
  jwt: {
    secret: '__JWT_SECRET__',
    options: {
      expiresIn: '7d',
    }
  },
  assets: {
    path: '/var/lib/cr7/assets',
    base_url: `${host}/data`,
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
  },
  wechatpay: {
    base_url: 'https://api.mch.weixin.qq.com',
    appid: 'wx8e0cd522cf168035',
    mchid: 'your_mchid',
    api_v3_secret: 'your_api_v3_secret',
    client_key_serial_no: 'your_key_serial_no',
    client_key_path: path.resolve(etc_path, 'wechatpay/apiclient_key.pem'),
    wechat_pay_serial: 'your_wechat_pay_serial',
    wechat_pay_public_key_path: path.resolve(etc_path, 'wechatpay/wechatpay_pub_key.pem'),
    callback_base_url: `${host}/api`,
  },
  xiecheng: {
    callback_base_url: host,
    base_url: 'https://ttdopen.ctrip.com',
    account_id: '5134daa94d22e8bc',
    secret: '<--ignore-->',
    aes_key: '<--ignore-->',
    aes_iv: '<--ignore-->',
  },
  mop: {
    base_url: 'https://myshow.test.maoyan.com',
    supplier: 'MY-MOP-233',
    aes_key: 'your_aes_key',
    public_key_path: path.resolve(etc_path, 'mop/public_key.cer'),
    private_key_path: path.resolve(etc_path, 'mop/private_key.cer'),
  }
}