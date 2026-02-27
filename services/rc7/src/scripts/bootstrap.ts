import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { Client } from "pg";
import { dbClientWrapper } from "./utils.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
export async function bootstrap(client: Client, { schema }: { schema: string }) {
  const bootstrapSQL = await fs.readFile(
    path.join(__dirname, '../..', 'db', 'bootstrap.sql'),
    'utf-8'
  );

  await client.query('BEGIN;');
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
    await client.query(`SET search_path TO "${schema}", public;`);
    await client.query(bootstrapSQL);
    await client.query(`SET search_path TO public;`);
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  }
}


export const command = 'bootstrap';
export const describe = '初始化 RC7 数据库';
export const builder = (yargs) => yargs
    .option('schema', {
        alias: 's',
        type: 'string',
        default: 'rc7',
        describe: '数据库 schema 名称'
    })
    .help();

export const handler = dbClientWrapper(bootstrap);
