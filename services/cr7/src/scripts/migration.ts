export const command = 'migration';
export const describe = 'Run database migrations';
export const builder = yargs => yargs
  .commandDir('migration')
  .demandCommand()
  .help();
