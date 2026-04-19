export const command = 'user';
export const describe = '用户相关命令';

export const builder = yargs => yargs
  .commandDir('user')
  .demandCommand()
  .help();
