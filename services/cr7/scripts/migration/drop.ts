import { Client } from 'pg';
import { dbClientWrapper } from '../utils.js';

async function drop(
  client: Client,
  { schema }: { schema: string }
) {
  await client.query('BEGIN;');
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
    await client.query('DELETE FROM schema_migrations WHERE scope = $1;', [schema]);
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  }
}

export const handler = dbClientWrapper(drop);