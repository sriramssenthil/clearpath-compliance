// Usage: npx tsx evals/inspect.ts 09 15   (case id prefixes)
// Prints the AI findings that were not in a case's expected labels, to judge whether each is a
// fair call or a false alarm.
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { analyzeAsset } from "../lib/compliance/engine";
import { PRODUCT_FACTS } from "../lib/seed/product-facts";
import { RULES } from "../lib/seed/rules";
import type { EvalCase } from "./types";

config({ path: ".env.local", quiet: true });

async function main() {
  const dir = path.join(__dirname, "cases");
  for (const prefix of process.argv.slice(2)) {
    const file = fs.readdirSync(dir).find((f) => f.startsWith(prefix));
    if (!file) continue;
    const c: EvalCase = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const facts = PRODUCT_FACTS.find((f) => f.product === c.product)!;
    const r = await analyzeAsset(c, { rules: RULES, facts });
    console.log(`\n=== ${c.id}  expected: ${c.expectedRuleCodes.join(", ") || "none"}`);
    for (const f of r.findings.filter((x) => !c.expectedRuleCodes.includes(x.ruleCode as never))) {
      console.log(`  EXTRA ${f.ruleCode} (${f.source}, ${f.confidence ?? "-"}): "${f.quote}"\n    ${f.issue}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
