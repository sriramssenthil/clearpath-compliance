// Verifies the AI spend guard degrades to rules-only instead of failing. Makes NO model call.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
process.env.AI_LIMIT_PER_USER_HOUR = "0";

async function main() {
  const { precheck } = await import("../lib/workflow/service");
  const r = await precheck(
    { id: 2, name: "Jordan Ellis", role: "affiliate", partnerId: 1 },
    { product: "personal_loan", channel: "email", states: [], content: `Guaranteed approval, no credit check. Test ${Date.now()}` },
  );
  const ok = r.analysis.status === "rules_only" && /paused/.test(r.analysis.aiNote ?? "") && r.analysis.findings.length > 0 && r.analysis.usage === null;
  console.log(ok ? "PASS" : "FAIL", { status: r.analysis.status, note: r.analysis.aiNote, findings: r.analysis.findings.length });
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
