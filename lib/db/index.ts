import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// neon-http has no interactive transactions; use db.batch([...]) when several writes must be atomic.
export const db = drizzle(neon(url), { schema });
export * as tables from "./schema";
