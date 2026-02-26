import { Client } from 'pg';

export async function runCommand(
  commandFunc: (client: Client, argv: Record<string, unknown>) => Promise<void>,
  { dir, conf, ...otherArgv }: { dir: string; conf: string; [key: string]: unknown }
) {
  process.env['NODE_CONFIG_DIR'] = dir;
  process.env['NODE_ENV'] = conf;

  const { default: config } = await import('config');
  const client = new Client(config.pg);

  try {
    await client.connect();
    await commandFunc(client, otherArgv);
  } catch (err) {
    console.error(err.message);
    throw err;
  } finally {
    await client.end();
  }
};

export function dbClientWrapper(
  commandFunc: (client: Client, argv: Record<string, unknown>) => Promise<void>
) {
  return async function (argv: { dir: string; conf: string; [key: string]: unknown }) {
    return runCommand(commandFunc, argv);
  };
}
