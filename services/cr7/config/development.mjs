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
  }
}