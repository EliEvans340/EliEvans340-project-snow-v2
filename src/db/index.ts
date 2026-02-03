import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// For backwards compatibility with existing code that imports `db` directly
// Note: This will throw at runtime if DATABASE_URL is not set
export const db = process.env.DATABASE_URL
  ? (() => {
      const sql = neon(process.env.DATABASE_URL);
      return drizzle(sql, { schema });
    })()
  : (null as unknown as NeonHttpDatabase<typeof schema>);

export * from "./schema";
