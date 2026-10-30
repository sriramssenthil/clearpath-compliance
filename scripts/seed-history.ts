import { config } from "dotenv";

// lib/db reads DATABASE_URL when it is imported, so env must be loaded first.
config({ path: ".env.local", quiet: true });

async function main() {
  const { resetDemoData } = await import("../lib/seed/history");
  const counts = await resetDemoData();
  console.log(counts);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
