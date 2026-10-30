"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_LABEL, PRODUCT_LABEL } from "@/components/queue/labels";
import { updateRuleAction, type RulePatch } from "@/app/(app)/rules/actions";

export interface RuleRowData {
  code: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  enabled: boolean;
  products: string[];
  channels: string[];
  citation: string;
  guidance: string;
  checkInstruction: string;
  version: number;
  detection: string;
  usesAi: boolean;
  configSummary: string;
  usage: { fired: string; agreed: string };
  /** Raw regex sources; sent to the client only for the lead. */
  patterns: { label: string; items: string[] }[] | null;
}

const field =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground shadow-card disabled:opacity-60";

function Chips({ values, all, labels }: { values: string[]; all: string; labels: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.length === 0 ? <Badge>{all}</Badge> : values.map((v) => <Badge key={v}>{labels[v] ?? v}</Badge>)}
    </div>
  );
}

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:cursor-default",
        checked ? "border-success-line bg-success" : "border-border-strong bg-surface-muted",
        disabled && "opacity-70",
      )}
    >
      <span aria-hidden className={cn("size-4 rounded-full bg-surface shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

export function RuleRow({ rule, canEdit }: { rule: RuleRowData; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fromRule = () => ({
    enabled: rule.enabled, severity: rule.severity, description: rule.description, guidance: rule.guidance, checkInstruction: rule.checkInstruction,
  });
  const [draft, setDraft] = useState(fromRule);
  // Re-sync the form when the stored rule changes (after a save, or someone else's edit). Done during render, not in an effect.
  const [seenVersion, setSeenVersion] = useState(rule.version);
  if (seenVersion !== rule.version) {
    setSeenVersion(rule.version);
    setDraft(fromRule());
  }
  const panelId = useId();

  // Deep links (/rules#CODE) open the matching row and scroll to it.
  useEffect(() => {
    const sync = () => {
      if (window.location.hash.slice(1) === rule.code) {
        setOpen(true);
        document.getElementById(rule.code)?.scrollIntoView({ block: "start" });
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [rule.code]);

  const patch: RulePatch = {};
  if (draft.enabled !== rule.enabled) patch.enabled = draft.enabled;
  if (draft.severity !== rule.severity) patch.severity = draft.severity;
  if (draft.description.trim() !== rule.description) patch.description = draft.description;
  if (draft.guidance.trim() !== rule.guidance) patch.guidance = draft.guidance;
  if (draft.checkInstruction.trim() !== rule.checkInstruction) patch.checkInstruction = draft.checkInstruction;
  const dirty = Object.keys(patch).length > 0;
  const LIMITS = { description: 2000, guidance: 2000, checkInstruction: 4000 } as const;
  const problem = (key: keyof typeof LIMITS) => {
    const n = draft[key].trim().length;
    return n < 10 ? "Write at least 10 characters." : n > LIMITS[key] ? `Keep it under ${LIMITS[key]} characters.` : null;
  };
  const invalid = (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).some((k) => problem(k) !== null);

  function save(p: RulePatch) {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateRuleAction(rule.code, p);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <li id={rule.code} className="scroll-mt-20 border-b border-border last:border-0" data-rule={rule.code}>
      <div className="grid items-start gap-x-4 gap-y-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_5.5rem_11rem_8.5rem_9.5rem_3rem]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="-m-1 flex items-start gap-2 rounded-md p-1 text-left hover:bg-surface-muted"
        >
          <ChevronRight aria-hidden className={cn("mt-1 size-4 shrink-0 text-subtle transition-transform", open && "rotate-90")} />
          <span className="min-w-0">
            <span className="block font-medium">{rule.title}</span>
            <span className="block font-mono text-xs text-subtle">
              {rule.code} <span className="font-sans">&middot; version {rule.version}</span>
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-7 lg:contents lg:pl-0">
          <div><SeverityBadge severity={rule.severity} /></div>
          <div className="space-y-1">
            <Chips values={rule.products} all="All products" labels={PRODUCT_LABEL as Record<string, string>} />
            <Chips values={rule.channels} all="All channels" labels={CHANNEL_LABEL as Record<string, string>} />
          </div>
          <div className="text-sm">{rule.detection}</div>
          <div className="text-sm">
            <span className="block">{rule.usage.fired}</span>
            <span className="block text-xs text-subtle">{rule.usage.agreed}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              disabled={!canEdit || pending}
              label={`${rule.title}: ${rule.enabled ? "enabled" : "disabled"}${canEdit ? ". Activate to change." : ""}`}
              onChange={() => save({ enabled: !rule.enabled })}
            />
            <span className="text-xs text-muted lg:sr-only">{rule.enabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </div>

      <div id={panelId} hidden={!open} className="space-y-4 border-t border-border bg-surface-muted/50 px-4 py-4 pl-4 text-sm lg:pl-11">
        {(
          <>
            <dl className="grid gap-4 lg:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">What it catches</dt>
                <dd className="mt-1">{rule.description}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Citation</dt>
                <dd className="mt-1">{rule.citation}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Guidance shown to submitters</dt>
                <dd className="mt-1">{rule.guidance}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Instruction for the AI check</dt>
                <dd className="mt-1">{rule.usesAi ? rule.checkInstruction : "Not used: this rule is decided by code alone."}</dd>
              </div>
              <div className="lg:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Deterministic check</dt>
                <dd className="mt-1">
                  {rule.configSummary}
                  {rule.patterns && rule.patterns.length > 0 ? (
                    <>
                      {" "}
                      <button type="button" onClick={() => setShowPatterns((s) => !s)} aria-expanded={showPatterns} className="font-medium text-accent underline-offset-2 hover:underline">
                        {showPatterns ? "Hide patterns" : "Show patterns"}
                      </button>
                    </>
                  ) : null}
                </dd>
                {showPatterns && rule.patterns ? (
                  <div className="mt-2 space-y-2">
                    {rule.patterns.map((g) => (
                      <div key={g.label}>
                        <p className="text-xs text-subtle">{g.label}</p>
                        <ul className="mt-1 space-y-1">
                          {g.items.map((p) => (
                            <li key={p} className="overflow-x-auto rounded border border-border bg-surface px-2 py-1 font-mono text-xs">{p}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </dl>

            {canEdit ? (
              <form
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dirty && !invalid) save(patch);
                }}
              >
                <h3 className="text-sm font-medium">Edit rule</h3>
                <p className="text-xs text-muted">Saving creates a new version. Every later analysis uses it; analyses already run are not changed.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Severity
                    <select className={field} value={draft.severity} disabled={pending} onChange={(e) => setDraft({ ...draft, severity: e.target.value as RuleRowData["severity"] })}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm">
                    <input type="checkbox" checked={draft.enabled} disabled={pending} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} className="size-4" />
                    Rule enabled
                  </label>
                </div>
                {([
                  ["description", "Description"],
                  ["guidance", "Guidance shown to submitters"],
                  ["checkInstruction", "Instruction for the AI check"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1 text-xs font-medium text-muted">
                    {label}
                    <textarea
                      className={cn(field, "min-h-24 leading-relaxed")}
                      rows={key === "checkInstruction" ? 5 : 3}
                      value={draft[key]}
                      disabled={pending}
                      aria-invalid={problem(key) !== null}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                    {problem(key) ? <span className="font-normal text-danger">{problem(key)}</span> : null}
                  </label>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!dirty || pending || invalid}>
                    {pending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!dirty || pending}
                    onClick={() => {
                      setDraft(fromRule());
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  {saved && !dirty ? <p role="status" className="text-sm text-success">Saved as version {rule.version}</p> : null}
                </div>
                {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              </form>
            ) : null}
          </>
        )}
      </div>
      {!open && (error || saved) ? (
        <p role={error ? "alert" : "status"} className={cn("px-4 pb-2 pl-11 text-xs", error ? "text-danger" : "text-success")}>
          {error ?? `Saved as version ${rule.version}`}
        </p>
      ) : null}
    </li>
  );
}
