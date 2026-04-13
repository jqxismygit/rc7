import path from 'node:path';
import { URL } from 'node:url';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default {
  pg: {
    database: 'cr7_dev',
  },
  assets: {
    path: path.resolve(__dirname, '../../../assets'),
  },
  fapiao: {
    base_url: 'https://dev.fapiao.com:19444/fpt-rhqz/prepose',
    app_id: '2d9688c1e9a68a8da702ffcc75f90226f0d8c7ea71076313d1088f50a8493093',
    secret: '48E92223495F210A',
    tax_id: '914402023073111101',
    company_name: '国票虚拟数电企业',
    company_address: '广东省韶关市武江区测试地址 100 号',
    company_phone: '0751-12345678',
    company_bank: '中国银行韶关分行',
    company_bank_account: '6222000000000000000',
    issuer: '开票人'
  }
}