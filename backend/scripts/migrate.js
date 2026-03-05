#!/usr/bin/env node
/**
 * Veritabanı migration'larını sırayla çalıştırır.
 * backend/migrations/*.sql dosyalarına göre.
 */
import pg from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../migrations');

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'secret',
  database: process.env.DB_NAME || 'callcenter_db',
});

async function migrate() {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  if (!files.length) {
    console.log('No migrations found.');
    return;
  }
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    try {
      await pool.query(sql);
      console.log(`OK: ${f}`);
    } catch (e) {
      if (e.code === '42P07' || e.message?.includes('already exists')) console.log(`SKIP (exists): ${f}`);
      else throw e;
    }
  }
  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
