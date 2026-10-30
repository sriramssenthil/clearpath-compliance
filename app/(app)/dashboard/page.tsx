import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { currentActor } from "@/lib/workflow/action-helpers";
import { dashboardStats } from "@/lib/workflow/queries";
import { SLA_HOURS } from "@/lib/workflow/flow";
import { Card, CardBody } from "@/components/ui/card";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { ResetDemo } from "@/components/dashboard/reset-demo";
import { AgingBars, AgreementBySource, KpiTiles, PartnerScorecard, Section, TopRules } from "@/components/dashboard/sections";
import { formatAbsolute } from "@/components/queue/sla-label";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireRole("lead");
  const actor = await currentActor();
  const stats = await dashboardStats(actor);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          How the review team is doing: whether the queue is under control, how fast decisions are made, and where the issues come from.
        </p>
        <p className="mt-1 text-xs text-subtle">Figures computed {formatAbsolute(stats.generatedAt)}.</p>
      </header>

      <Section id="kpis" title="Key figures" caption="Each tile defines its own measure underneath. Where there is not enough history to compute one, it says so instead of showing zero.">
        <KpiTiles stats={stats} />
      </Section>

      <Section id="throughput" title="Weekly throughput" caption="Decisions recorded per week over the last 8 weeks, split by outcome. One submission can contribute several decisions if it goes through rework.">
        <Card>
          <CardBody>
            <WeeklyChart weeks={stats.weekly} />
          </CardBody>
        </Card>
      </Section>

      <Section id="aging" title="Queue aging" caption={`How long submissions still waiting for review have been in the queue, counted from when they were submitted. Beyond 3 days is past the ${SLA_HOURS.standard}-hour standard SLA.`}>
        <AgingBars buckets={stats.queue.aging} />
      </Section>

      <Section id="issues" title="Most frequent issues" caption="The rules that flagged the most findings on versions submitted in the last 8 weeks. Reviewers agreed is accepted findings divided by accepted plus dismissed; open findings are not counted.">
        <TopRules rules={stats.topRules} />
      </Section>

      <Section
        id="agreement"
        title="Reviewer agreement by source"
        caption="A dismissal means the reviewer judged the flag not to apply. This is the feedback loop for tuning rules and prompts. Counts cover all recorded history; open findings are not counted."
      >
        <AgreementBySource rows={stats.acceptance} />
      </Section>

      <Section id="partners" title="Partner scorecard" caption="Affiliates are ClearPath's third parties; their history feeds the risk score of every new submission. Select a partner to see its submissions in the queue.">
        <PartnerScorecard partners={stats.partners} />
      </Section>

      <footer className="space-y-4 border-t border-border pt-6">
        <section aria-labelledby="assumptions">
          <h2 id="assumptions" className="text-sm font-medium">
            Assumptions
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>
              SLA windows: {SLA_HOURS.standard} hours for standard submissions; {SLA_HOURS.expedited} hours for expedited submissions and for re-reviews of a revised version. The clock runs only while compliance holds the item, not while the submitter is revising.
            </li>
            <li>Partner standing needs at least 3 decided submissions. Above 15% rejected is Watch; above 30% is High risk.</li>
            <li>All figures are computed from the audit-backed records in this demo (submissions, versions, findings, decisions). The history is generated sample data for a fictional company.</li>
          </ul>
        </section>
        <section aria-labelledby="reset" className="space-y-2">
          <h2 id="reset" className="text-sm font-medium">
            Demo controls
          </h2>
          <p className="text-sm text-muted">Lead only. Restores the sample history so the next person starts from the same place.</p>
          <ResetDemo />
        </section>
      </footer>
    </div>
  );
}
