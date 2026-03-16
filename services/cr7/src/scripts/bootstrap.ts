import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { Client } from "pg";
import { dbClientWrapper } from "./utils.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
export async function bootstrap(client: Client, args?: { log?: boolean }) {
  const { log } = args ?? { log: false };
  const bootstrapSQL = await fs.readFile(
    path.join(__dirname, '../..', 'db', 'bootstrap.sql'),
    'utf-8'
  );

  await client.query('BEGIN;');
  try {
    await client.query(bootstrapSQL);
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  }

  if (log) {
    console.log('Bootstrap completed successfully.');
  }
}


export const command = 'bootstrap';
export const describe = '初始化数据库';

export const handler = dbClientWrapper(bootstrap);
