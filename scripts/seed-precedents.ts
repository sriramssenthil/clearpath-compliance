import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { seedPrecedents } = await import("../lib/seed/precedents");
  const count = await seedPrecedents();
  console.log({ precedents: count });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
