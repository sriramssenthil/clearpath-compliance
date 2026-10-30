import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { loadFacts, loadRules } from "@/lib/data/reference";
import { listRulesWithUsage } from "@/lib/workflow/queries";
import { PRODUCTS } from "@/lib/compliance/types";
import { RuleRow, type RuleRowData } from "@/components/rules/rule-row";
import { ProductFactsPanel } from "@/components/rules/product-facts";
import { configPatterns, describeConfig, detectionLabel, DETECTION_CAPTION, usageText } from "@/components/rules/rule-meta";

export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const user = await requireRole("reviewer", "lead");
  const canEdit = user.role === "lead";
  const [rules, defs, ...facts] = await Promise.all([listRulesWithUsage(), loadRules(), ...PRODUCTS.map((p) => loadFacts(p))]);
  const config = new Map(defs.map((d) => [d.code, d.config]));

  const rows: (RuleRowData & { category: string })[] = rules.map((r) => {
    const cfg = config.get(r.code) ?? { type: "none" as const };
    const patterns = canEdit ? configPatterns(cfg) : [];
    return {
      category: r.category,
      code: r.code,
      title: r.title,
      description: r.description,
      severity: r.severity,
      enabled: r.enabled,
      products: r.products,
      channels: r.channels,
      citation: r.citation,
      guidance: r.guidance,
      checkInstruction: r.checkInstruction,
      version: r.version,
      detection: detectionLabel(r.kind, r.aiReview),
      usesAi: r.kind === "ai" || r.aiReview,
      configSummary: describeConfig(cfg),
      usage: usageText(r.usage),
      patterns: canEdit ? patterns : null,
    };
  });
  const order = ["Reg Z", "Mortgage", "UDAAP", "FCRA", "FTC", "ECOA", "State", "Channel", "Security"];
  const rank = (c: string) => (order.indexOf(c) === -1 ? order.length : order.indexOf(c));
  const categories = [...new Set(rows.map((r) => r.category))].sort((a, b) => rank(a) - rank(b));
  const enabledCount = rows.filter((r) => r.enabled).length;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rules library</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {rows.length} rules, {enabledCount} enabled.{" "}
          {canEdit ? "As compliance lead you can enable, disable and edit rules." : "You have read-only access; the compliance lead edits rules."}
        </p>
      </header>

      <div role="note" className="flex gap-3 rounded-lg border border-info-line bg-info-soft px-4 py-3 text-sm text-info">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>Rules are data, not prompt text. Compliance edits them here; every later analysis uses the new version.</p>
      </div>

      <section aria-labelledby="rules-heading" className="space-y-6">
        <div>
          <h2 id="rules-heading" className="text-lg font-semibold tracking-tight">Rules</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">{DETECTION_CAPTION}</p>
        </div>
        {categories.map((cat) => {
          const group = rows.filter((r) => r.category === cat);
          return (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h3 id={`cat-${cat}`} className="mb-2 text-sm font-semibold">
                {cat} <span className="font-normal text-subtle">({group.length})</span>
              </h3>
              <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
                <div
                  aria-hidden
                  className="hidden gap-x-4 border-b border-border bg-surface-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-subtle lg:grid lg:grid-cols-[minmax(0,1fr)_5.5rem_11rem_8.5rem_9.5rem_3rem]"
                >
                  <span className="pl-6">Rule</span>
                  <span>Severity</span>
                  <span>Scope</span>
                  <span>Detection</span>
                  <span>Usage</span>
                  <span>On</span>
                </div>
                <ul>
                  {group.map((rule) => (
                    <RuleRow key={rule.code} rule={rule} canEdit={canEdit} />
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
        <p className="text-xs text-subtle">
          Usage counts every finding the rule has produced. Reviewers agreed is accepted findings divided by accepted plus dismissed; open findings are not counted.
        </p>
      </section>

      <section aria-labelledby="facts-heading" className="space-y-3">
        <div>
          <h2 id="facts-heading" className="text-lg font-semibold tracking-tight">Product facts</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">
            What ClearPath actually offers, and the approved disclosure wording. These are the source of truth the checker compares ad claims against; they are read-only here.
          </p>
        </div>
        <div className="space-y-3">
          {facts.map((f, i) => (
            <ProductFactsPanel key={f.product} data={f} defaultOpen={i === 0} />
          ))}
        </div>
      </section>
    </div>
  );
}
