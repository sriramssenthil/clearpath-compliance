"use client";

import { Keyboard } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { findingAction } from "@/app/(app)/submissions/[id]/actions";
import type { AssetInfo } from "@/lib/compliance/feature-types";
import type { Permissions } from "@/lib/workflow/types";
import { AssetText, AssetViewer } from "./asset-viewer";
import type { Status } from "@/lib/workflow/flow";
import { AddFindingForm } from "./add-finding-form";
import { DecisionPanel, type ClosedDecision } from "./decision-panel";
import { FindingsPanel, matchesFilter, type AnalysisInfo } from "./findings-panel";
import { type HighlightMark, type TextSelection } from "./highlighted-text";
import { unlocatedIds } from "./segments";
import type { FindingFilter, FindingVM, RuleOption } from "./view-models";

interface Props {
  submissionId: number;
  code: string;
  title: string;
  submitterName: string;
  status: Status;
  permissions: Permissions;
  versionNumber: number;
  latestNumber: number;
  content: string;
  analysis: AnalysisInfo;
  findings: FindingVM[];
  latestFindings: FindingVM[];
  rules: RuleOption[];
  lastDecision: ClosedDecision | null;
  /** Server-rendered diff; replaces the highlighted text while comparing. */
  diffSlot: ReactNode | null;
  /** Uploaded file of the viewed version; its transcription is the first part of `content`. */
  asset?: AssetInfo | null;
}

const SEV_WORD = { high: "High", medium: "Medium", low: "Low" } as const;

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function ReviewerWorkspace(p: Props) {
  const canAct = p.permissions.canActOnFindings && p.versionNumber === p.latestNumber;
  const [filter, setFilter] = useState<FindingFilter>(() => (p.findings.some((f) => f.status === "open") ? "open" : "all"));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<"text" | "findings">("text");
  const [legend, setLegend] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [dismissOpenId, setDismissOpenIdRaw] = useState<number | null>(null);
  // Only one reason box is open at a time: opening a dismiss form closes the decision confirm step and vice versa.
  const [decisionCloseSignal, setDecisionCloseSignal] = useState(0);
  const setDismissOpenId = useCallback((id: number | null) => {
    setDismissOpenIdRaw(id);
    if (id !== null) setDecisionCloseSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDismissOpenIdRaw(null);
      setDecisionCloseSignal((n) => n + 1);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);
  const [draft, setDraft] = useState<TextSelection | null>(null);
  const [, startTransition] = useTransition();

  const unlocated = useMemo(() => new Set(unlocatedIds(p.content, p.findings)), [p.content, p.findings]);
  const ordered = useMemo(() => {
    const shown = p.findings.filter((f) => matchesFilter(f, filter));
    return [...shown.filter((f) => !unlocated.has(f.id)), ...shown.filter((f) => unlocated.has(f.id))];
  }, [p.findings, filter, unlocated]);

  const marks: HighlightMark[] = useMemo(
    () =>
      p.findings.map((f) => ({
        id: f.id, start: f.start, end: f.end, severity: f.severity, status: f.status,
        label: `${SEV_WORD[f.severity]} severity: ${f.ruleTitle} (${f.ruleCode}), ${f.status}. Click to open the finding.`,
      })),
    [p.findings],
  );

  const select = useCallback(
    (id: number, from: "mark" | "card" | "key" = "card") => {
      setSelectedId(id);
      setTick((t) => t + 1);
      const f = p.findings.find((x) => x.id === id);
      if (f && !matchesFilter(f, filter)) setFilter("all");
      if (from === "mark" && typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) setTab("findings");
    },
    [p.findings, filter],
  );

  const run = useCallback(
    (id: number, act: Parameters<typeof findingAction>[1]) => {
      const idx = ordered.findIndex((f) => f.id === id);
      const next = ordered[idx + 1] ?? ordered[idx - 1];
      setPendingId(id);
      setErrors((e) => ({ ...e, [id]: "" }));
      startTransition(async () => {
        const res = await findingAction(id, act, p.submissionId);
        if (!res.ok) setErrors((e) => ({ ...e, [id]: res.error }));
        else {
          if (act.action === "dismiss") setDismissOpenId(null);
          // Triage flow: deciding a finding in the Open list moves on to the next one.
          if (filter === "open" && act.action !== "reopen" && next && selectedId === id) select(next.id, "key");
        }
        setPendingId(null);
      });
    },
    [ordered, p.submissionId, filter, selectedId, select, setDismissOpenId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setLegend((v) => !v);
        return;
      }
      if (e.key === "j" || e.key === "k") {
        if (ordered.length === 0) return;
        e.preventDefault();
        const i = ordered.findIndex((f) => f.id === selectedId);
        const n = i === -1 ? 0 : Math.min(ordered.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)));
        select(ordered[n].id, "key");
        return;
      }
      const cur = p.findings.find((f) => f.id === selectedId);
      if (!canAct || !cur || cur.status === "resolved" || pendingId !== null) return;
      if (e.key === "a" && cur.status !== "accepted") {
        e.preventDefault();
        run(cur.id, { action: "accept" });
      } else if (e.key === "d" && cur.status !== "dismissed") {
        e.preventDefault();
        setDismissOpenId(cur.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, selectedId, canAct, pendingId, p.findings, select, run, setDismissOpenId]);

  const addFinding = canAct
    ? (sel: TextSelection) => {
        setDraft(sel);
        setTab("findings");
      }
    : undefined;

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Switch between asset text and findings" className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 lg:hidden">
        {(["text", "findings"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={cn("rounded-md px-3 py-2 text-sm font-medium", tab === k ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-muted")}
          >
            {k === "text" ? "Asset text" : `Findings (${p.findings.length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Asset text" className={cn("min-w-0", tab === "text" ? "block" : "hidden", "lg:block")}>
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium text-foreground">
                {p.diffSlot ? `Changes in version ${p.versionNumber}` : `${p.asset ? "Asset file and text" : "Asset text"}, version ${p.versionNumber}`}
              </h2>
              {!p.diffSlot ? <MarkLegend /> : null}
            </div>
            <div className="space-y-6 px-5 py-5 sm:px-8">
              {p.asset ? <AssetViewer asset={p.asset} className="mx-auto max-w-[68ch]" /> : null}
              {p.diffSlot ?? (
                <AssetText
                  content={p.content}
                  hasFile={Boolean(p.asset)}
                  marks={marks}
                  selectedId={selectedId}
                  pulseKey={tick}
                  onSelect={(id) => select(id, "mark")}
                  onAddFinding={addFinding}
                  className="mx-auto max-w-[68ch]"
                />
              )}
            </div>
            {canAct && !p.diffSlot ? (
              <p className="border-t border-border px-5 py-2.5 text-xs text-subtle">Select any wording in the text to add your own finding against a rule.</p>
            ) : null}
          </div>
        </section>

        <aside
          aria-label="Findings and decision"
          className={cn(
            "min-w-0 flex-col gap-3 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100vh-5.75rem)] lg:self-start",
            tab === "findings" ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-foreground">Findings ({p.findings.length})</h2>
            <button
              type="button"
              onClick={() => setLegend((v) => !v)}
              aria-expanded={legend}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-subtle hover:bg-surface-muted hover:text-foreground"
            >
              <Keyboard aria-hidden className="size-3.5" />
              Shortcuts <kbd className="rounded border border-border-strong px-1 font-mono text-[10px]">?</kbd>
            </button>
          </div>
          {legend ? <ShortcutLegend canAct={canAct} /> : null}
          <div className="min-h-0 space-y-3 lg:min-h-[14rem] lg:flex-1 lg:overflow-y-auto lg:pr-1" tabIndex={-1}>
            <FindingsPanel
              analysis={p.analysis}
              findings={p.findings}
              unlocated={unlocated}
              filter={filter}
              onFilter={setFilter}
              selectedId={selectedId}
              selectTick={tick}
              canAct={canAct}
              pendingId={pendingId}
              errors={errors}
              dismissOpenId={dismissOpenId}
              onSelect={(id) => select(id, "card")}
              onAccept={(id) => run(id, { action: "accept" })}
              onReopen={(id) => run(id, { action: "reopen" })}
              onDismiss={(id, reason) => run(id, { action: "dismiss", reason })}
              onDismissOpenChange={(id, open) => setDismissOpenId(open ? id : null)}
              top={
                draft && canAct ? (
                  <AddFindingForm key={`${draft.start}-${draft.end}`} submissionId={p.submissionId} selection={draft} rules={p.rules} onClose={() => setDraft(null)} />
                ) : null
              }
            />
          </div>
          <div className="lg:max-h-[40vh] lg:shrink-0 lg:overflow-y-auto">
            <DecisionPanel
              submissionId={p.submissionId}
              submissionCode={p.code}
              submissionTitle={p.title}
              submitterName={p.submitterName}
              status={p.status}
              versionNumber={p.versionNumber}
              latestNumber={p.latestNumber}
              latestFindings={p.latestFindings}
              canDecide={p.permissions.canDecide}
              lastDecision={p.lastDecision}
              closeSignal={decisionCloseSignal}
              onConfirmOpen={() => {
                setDismissOpenIdRaw(null);
                setDraft(null);
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MarkLegend() {
  return (
    <div role="group" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle" aria-label="Highlight key">
      <span><mark className="rounded-[3px] bg-sev-high-soft px-1 underline decoration-sev-high decoration-2 underline-offset-4 text-foreground">High</mark> solid</span>
      <span><mark className="rounded-[3px] bg-sev-medium-soft px-1 underline decoration-dashed decoration-sev-medium decoration-2 underline-offset-4 text-foreground">Medium</mark> dashed</span>
      <span><mark className="rounded-[3px] bg-sev-low-soft px-1 underline decoration-dotted decoration-sev-low decoration-2 underline-offset-4 text-foreground">Low</mark> dotted</span>
      <span>Bold with outline: accepted. Faded: dismissed. Struck: resolved.</span>
    </div>
  );
}

function ShortcutLegend({ canAct }: { canAct: boolean }) {
  const rows: [string, string][] = [["j / k", "Next / previous finding"], ...(canAct ? ([["a", "Accept selected finding"], ["d", "Dismiss selected finding (asks for a reason)"]] as [string, string][]) : []), ["?", "Show or hide this list"]];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs" aria-label="Keyboard shortcuts">
      {rows.map(([k, d]) => (
        <div key={k} className="contents">
          <dt><kbd className="rounded border border-border-strong bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{k}</kbd></dt>
          <dd className="text-muted">{d}</dd>
        </div>
      ))}
    </dl>
  );
}
