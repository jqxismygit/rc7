import { Client } from 'pg';

export async function runCommand<Args extends Record<string, unknown>>(
  commandFunc: (client: Client, argv: Args) => Promise<void>,
  args: { dir: string; conf: string; } & Args
) {
  const { dir, conf } = args ?? { };
  if (dir) {
    process.env['NODE_CONFIG_DIR'] = dir;
  }
  if (conf) {
    process.env['NODE_ENV'] = conf;
  }

  const { default: config } = await import('config');
  const client = new Client(config.pg);

  try {
    await client.connect();
    await commandFunc(client, args);
  } catch (err) {
    console.error(err.message);
    throw err;
  } finally {
    await client.end();
  }
};

export function dbClientWrapper<Args extends Record<string, unknown>>(
  commandFunc: (client: Client, argv?: Args) => Promise<void>
) {
  return async function handler(argv?: Args) {
    return runCommand<Args>(
      commandFunc,
      argv as { dir: string; conf: string; } & Args
    );
  };
}