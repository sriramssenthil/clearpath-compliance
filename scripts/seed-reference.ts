import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { seedReference } = await import("../lib/seed/reference");
  const counts = await seedReference();
  console.log(counts);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
