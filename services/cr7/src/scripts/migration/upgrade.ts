import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { Client } from 'pg';
import { dbClientWrapper } from '../utils.js';

export const command = 'upgrade';
export const describe = 'Run database migrations to upgrade to the latest version';

const migrationsDir = new URL('../../../db/migrations/', import.meta.url).pathname;

async function listMigrations() {
  const files = await fs.readdir(migrationsDir);
  return files.map(file => [
    file.split('_')[0],
    path.resolve(migrationsDir, file)
  ]);
}

export async function migrate(
  client: Client,
  { log, schema }: { log?: boolean; schema: string }
) {
  const {
    rows: versions
  } = await client.query(
    `SELECT version FROM schema_migrations where scope = $1`,
    [schema]
  );
  const installedMigrations = new Set(versions.map(r => r.version));

  const allMigrations = await listMigrations();
  const migrations = allMigrations
    .filter(([version]) => !installedMigrations.has(version));

  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
    await client.query(`SET search_path TO "${schema}", public`);

    for (const [version, sqlPath] of migrations) {
      const sql = await fs.readFile(sqlPath, 'utf-8');
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (scope, version)
        VALUES ($1, $2)`,
        [schema, version]
      );

      if (log) {
        console.log(`Applied migration: ${version}`);
      }
    }
    await client.query('SET search_path TO public;');
    await client.query('COMMIT');
  } catch (error) {
    console.error('Migration failed:', error);
    await client.query('ROLLBACK');
    throw error;
  }
}

export const handler = dbClientWrapper(migrate);
