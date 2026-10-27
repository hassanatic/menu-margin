import { readFileSync } from "node:fs";
import path from "node:path";

// The repository code only needs "run a parameterised query and give me rows".
// Both node-postgres and PGlite can do that, so the app talks to this small
// interface and the choice of driver stays in one place.

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

const schemaSql = () => readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");

export async function migrate(db: Db): Promise<void> {
  await db.exec(schemaSql());
}

export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  const db: Db = {
    query: async (sql, params) => {
      const res = await pg.query(sql, params as unknown[] | undefined);
      return { rows: res.rows as never[] };
    },
    exec: (sql) => pg.exec(sql),
  };
  await migrate(db);
  return db;
}

export async function openPostgres(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  const db: Db = {
    query: async (sql, params) => {
      const res = await pool.query(sql, params as unknown[] | undefined);
      return { rows: res.rows };
    },
    exec: (sql) => pool.query(sql),
  };
  await migrate(db);
  return db;
}

let shared: Promise<Db> | undefined;

// One connection for the whole Next.js server process.
export function getDb(): Promise<Db> {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    shared = url ? openPostgres(url) : openPglite(path.join(process.cwd(), "data", "pglite"));
  }
  return shared;
}
