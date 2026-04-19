#!/usr/bin/env node

import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));

yargs(hideBin(process.argv))
  .options({
    d: {
      alias: 'dir',
      demandOption: false,
      default: path.join(__dirname, '../..', 'config'),
      type: 'string',
      describe: '配置文件目录'
    },
    c: {
      alias: 'conf',
      demandOption: false,
      default: 'development',
      type: 'string',
      describe: '配置类型',
      choices: ['development', 'production']
    },
    v: {
      alias: 'verbose',
      type: 'boolean',
      default: false,
      describe: '启用详细日志'
    },
    schema: {
      type: 'string',
      default: 'cr7',
      describe: '数据库 schema 名称'
    }
  })
  .commandDir('.', { exclude: /cr7/ })
  .demandCommand()
  .usage('$0 <command> [options]')
  .help(true)
  .wrap(72)
  .showHelpOnFail(true)
  .strict()
  .parse();
