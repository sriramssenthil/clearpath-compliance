import { config } from "dotenv";
config({ path: ".env.local" });

import { NetImpressionError, runNetImpression } from "../lib/compliance/net-impression";
import { EXAMPLE_ASSETS } from "../lib/seed/examples";
import { PRODUCT_FACTS } from "../lib/seed/product-facts";

// Three live calls: two risky ads that should produce misleading beliefs, one compliant ad that should not.
const IDS = ["risky-affiliate-blog", "card-intro-banner", "clean-loan-display"];

async function main() {
  for (const id of IDS) {
    const ex = EXAMPLE_ASSETS.find((e) => e.id === id);
    const facts = PRODUCT_FACTS.find((f) => f.product === ex?.product);
    if (!ex || !facts) throw new Error(`Missing example or facts for ${id}`);
    console.log(`\n=== ${ex.label} (${ex.id})`);
    try {
      const r = await runNetImpression(
        { product: ex.product, channel: ex.channel, states: ex.states, content: ex.content, isAffiliate: ex.isAffiliate },
        facts,
      );
      console.log(`Takeaway: "${r.impression.takeaway}"`);
      for (const b of r.impression.beliefs) console.log(`  [${b.misleading ? "MISLEADING" : "accurate"}] ${b.belief}\n      actual: ${b.actual}`);
      const u = r.usage;
      console.log(`model ${r.impression.model} | ${r.latencyMs} ms | in ${u.inputTokens} out ${u.outputTokens} cache read ${u.cacheReadTokens} write ${u.cacheWriteTokens}`);
    } catch (err) {
      if (err instanceof NetImpressionError) console.log(`FAILED (${err.reason}): ${err.message}`);
      else throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
