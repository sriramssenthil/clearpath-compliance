"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, FileText, Info, RefreshCw, TriangleAlert } from "lucide-react";
import type { AnchoredFinding } from "@/lib/compliance/types";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FindingCard } from "./finding-card";
import { PrecedentHint } from "./precedent-hint";
import { NetImpressionCard } from "@/components/review/net-impression-card";
import { validSpan } from "./segments";
import { STAGES, type PrecheckHandle } from "./use-precheck";

interface Props {
  pre: PrecheckHandle;
  /** Findings in text order; indexes here are the keys used for highlight/card linking. */
  sorted: AnchoredFinding[];
  stale: boolean;
  canRun: boolean;
  activeKey: number | null;
  notes: Record<number, string>;
  onRun: () => void;
  onReplace: (index: number) => void;
  onAppend: (index: number) => void;
  onShow: (index: number) => void;
  /** The transcription of the uploaded file, already highlighted. Null for text-only results. */
  fileText?: ReactNode;
  /** The file was read but no text was found in it. */
  fileTextEmpty?: boolean;
}

const SEV_ORDER = ["high", "medium", "low"] as const;
const SEV_STYLE = {
  high: "border-sev-high-line bg-sev-high-soft text-sev-high",
  medium: "border-sev-medium-line bg-sev-medium-soft text-sev-medium",
  low: "border-sev-low-line bg-sev-low-soft text-sev-low",
} as const;

function Progress({ stage }: { stage: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 py-2">
      <style>{`@keyframes cp-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
        <div className="h-full w-2/5 rounded-full bg-accent" style={{ animation: "cp-indeterminate 1.4s ease-in-out infinite" }} />
      </div>
      <p className="text-sm font-medium">{STAGES[Math.min(stage, STAGES.length - 1)]}</p>
      <p className="text-xs text-muted">This usually takes 5 to 10 seconds. Nothing is submitted to compliance.</p>
    </div>
  );
}

export function PrecheckPanel({ pre, sorted, stale, canRun, activeKey, notes, onRun, onReplace, onAppend, onShow, fileText, fileTextEmpty }: Props) {
  const { phase, result, error } = pre;
  const analysis = result?.analysis;
  const running = phase === "running";
  const located = sorted.map((f, i) => ({ f, i })).filter(({ f }) => validSpan(analysis?.content ?? "", f) !== null);
  const unlocated = sorted.map((f, i) => ({ f, i })).filter(({ f }) => validSpan(analysis?.content ?? "", f) === null);
  const counts = SEV_ORDER.map((s) => [s, sorted.filter((f) => f.severity === s).length] as const);

  const card = ({ f, i }: { f: AnchoredFinding; i: number }) => (
    <FindingCard
      key={`${f.ruleCode}-${i}`}
      index={i}
      finding={f}
      info={result?.ruleInfo[f.ruleCode]}
      located={!stale && validSpan(analysis?.content ?? "", f) !== null}
      active={activeKey === i}
      note={notes[i]}
      onReplace={() => onReplace(i)}
      onAppend={() => onAppend(i)}
      onShow={() => onShow(i)}
    >
      <PrecedentHint matches={result?.precedents?.[analysis?.findings.indexOf(f) ?? -1]} className="mt-3" />
    </FindingCard>
  );

  return (
    <Card aria-label="Pre-check results">
      <CardHeader>
        <CardTitle>Pre-check</CardTitle>
        <CardDescription>
          Rules plus an AI review, run before compliance sees anything. This pre-check is advisory. Compliance makes the final call.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        {phase === "idle" && !result ? (
          <p className="text-sm text-muted">
            Run the pre-check to see which rules apply to this product, channel and state, with the exact text each finding refers to and a suggested fix.
            {!canRun ? " Attach the ad file or add the asset text first." : ""}
          </p>
        ) : null}

        {running ? <Progress stage={pre.stage} /> : null}

        {phase === "error" ? (
          <div role="alert" className="flex gap-2 rounded-md border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">The pre-check did not complete.</p>
              <p className="mt-0.5">{error}</p>
              {result ? <p className="mt-1 text-muted">The results below are from your last successful check.</p> : null}
            </div>
          </div>
        ) : null}

        {result && analysis ? (
          <div className={cn("space-y-4", running && "opacity-60")} aria-busy={running}>
            {stale && !running ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
                <span className="flex items-center gap-2 font-medium">
                  <TriangleAlert aria-hidden className="size-4" />
                  Out of date: edited since last check
                </span>
                <Button size="sm" variant="secondary" onClick={onRun} disabled={!canRun}>
                  <RefreshCw aria-hidden className="size-3.5" />
                  Re-run pre-check
                </Button>
              </div>
            ) : null}

            {analysis.status === "rules_only" ? (
              <div className="flex gap-2 rounded-md border border-info-line bg-info-soft p-3 text-sm text-info">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">{analysis.aiNote ?? "The AI review was unavailable, so only the rule-based checks ran."}</p>
                  <p className="mt-0.5 text-foreground/80">Findings below come from the rule library only. Try again in a moment for the full check.</p>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-sm leading-6">{analysis.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Findings by severity">
                {counts.map(([sev, n]) => (
                  <span key={sev} className={cn("rounded-md border px-2.5 py-1 text-sm font-medium", n > 0 ? SEV_STYLE[sev] : "border-border text-muted")}>
                    {n} {sev === "high" ? "High" : sev === "medium" ? "Medium" : "Low"}
                  </span>
                ))}
              </div>
              <p
                className={cn(
                  "mt-3 flex items-center gap-2 text-sm font-medium",
                  analysis.recommendation === "needs_changes" ? "text-warning" : "text-success",
                )}
              >
                {analysis.recommendation === "needs_changes" ? <TriangleAlert aria-hidden className="size-4" /> : <CheckCircle2 aria-hidden className="size-4" />}
                {analysis.recommendation === "needs_changes" ? "Likely to need changes" : "No issues found by the automated check"}
              </p>
              <p className="mt-0.5 text-xs text-muted">This pre-check is advisory. Compliance makes the final call.</p>
            </div>

            {fileText || fileTextEmpty ? (
              <section aria-labelledby="file-text-heading" className="space-y-2">
                <h4 id="file-text-heading" className="flex items-center gap-2 text-sm font-medium">
                  <FileText aria-hidden className="size-4 text-muted" />
                  Text read from your file
                </h4>
                <p className="text-xs text-muted">
                  Transcribed by the AI checker; this is the text the rules were run on. If something was misread, compliance still reviews the original file.
                </p>
                {fileTextEmpty ? (
                  <p className="rounded-md border border-dashed border-border-strong px-3 py-3 text-sm text-muted">No text was found in the file.</p>
                ) : (
                  fileText
                )}
              </section>
            ) : null}

            {sorted.length > 0 ? (
              <>
                <p className="text-xs text-muted">
                  Use <span className="font-medium text-foreground">Replace quoted text</span> to reword a claim and{" "}
                  <span className="font-medium text-foreground">Add to end</span> to add a missing disclosure. They only appear when there is ready-to-use copy.
                </p>
                <ol className="space-y-3" aria-label="Findings in the order they appear in the text">
                  {located.map(card)}
                </ol>
                {unlocated.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Not located in the text</h4>
                    <p className="text-xs text-muted">These apply to the asset as a whole or quote text the checker could not pin to one spot.</p>
                    <ol className="space-y-3">{unlocated.map(card)}</ol>
                  </div>
                ) : null}
              </>
            ) : null}

            {result?.netImpression && !stale ? <NetImpressionCard impression={result.netImpression} facts={result.facts} /> : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
