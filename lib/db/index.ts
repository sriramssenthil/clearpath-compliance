import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return drizzle(neon(url), { schema });
}

let client: ReturnType<typeof connect> | undefined;

/**
 * Connects on first use, not at import, so `next build` and static analysis work without a database
 * and a missing DATABASE_URL fails with a clear message at the first query.
 * neon-http has no interactive transactions; use db.batch([...]) when several writes must be atomic.
 */
export const db = new Proxy({} as ReturnType<typeof connect>, {
  get(_target, prop) {
    client ??= connect();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export * as tables from "./schema";
