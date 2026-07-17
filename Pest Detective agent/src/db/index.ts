import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let pool: Pool | null = null;

type DbClient = ReturnType<typeof drizzle> & {
  execute<T = unknown>(query: unknown): Promise<{ rows: Array<T> }>;
};

let dbInstance: DbClient | null = null;

if (databaseUrl) {
  pool = globalForDb.__arenaNextJsPostgresqlPool ?? new Pool({ connectionString: databaseUrl });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  dbInstance = drizzle(pool) as DbClient;
} else {
  dbInstance = {
    execute: async () => {
      throw new Error("DATABASE_URL is not configured");
    },
  } as unknown as DbClient;
}

export const poolInstance = pool;
export const db = dbInstance as DbClient;
