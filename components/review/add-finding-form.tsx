"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addReviewerFindingAction } from "@/app/(app)/submissions/[id]/actions";
import type { TextSelection } from "./highlighted-text";
import type { RuleOption } from "./view-models";

const SEV = { high: "High severity", medium: "Medium severity", low: "Low severity" } as const;

export function AddFindingForm({
  submissionId, selection, rules, onClose,
}: {
  submissionId: number;
  selection: TextSelection;
  rules: RuleOption[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [ruleCode, setRuleCode] = useState("");
  const [issue, setIssue] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rules.filter((r) => r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)) : rules;
  }, [rules, query]);
  const chosen = rules.find((r) => r.code === ruleCode);
  const issueOk = issue.trim().length >= 5;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return setError("Choose the rule this breaks.");
    if (!issueOk) return setError("Describe the issue in a sentence.");
    setError(null);
    start(async () => {
      const res = await addReviewerFindingAction(submissionId, {
        ruleCode, quote: selection.text, issue: issue.trim(), suggestion: suggestion.trim() || null,
      });
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} aria-label="Add a finding" className="space-y-3 rounded-lg border border-accent-line bg-accent-soft/40 p-3.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-foreground">Add a finding</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
      <div>
        <p className="text-xs font-medium text-muted">Selected text (becomes the quote)</p>
        <blockquote className="mt-1 max-h-24 overflow-y-auto break-words rounded-sm border-l-[3px] border-accent bg-surface px-2.5 py-1.5 font-mono text-[12.5px]">{selection.text}</blockquote>
      </div>
      <div>
        <label htmlFor="af-rule-search" className="text-xs font-medium text-muted">Rule</label>
        <input
          id="af-rule-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code or title"
          className="mt-1 h-9 w-full rounded-md border border-border-strong bg-background px-2.5 text-sm placeholder:text-subtle"
        />
        <select
          aria-label="Rule"
          size={Math.min(5, Math.max(2, filtered.length))}
          value={ruleCode}
          onChange={(e) => setRuleCode(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-border-strong bg-background p-1 text-sm"
        >
          {filtered.length === 0 ? <option disabled>No matching rule</option> : null}
          {filtered.map((r) => (
            <option key={r.code} value={r.code}>{r.code} - {r.title}</option>
          ))}
        </select>
        {chosen ? (
          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
            <Badge variant={`severity-${chosen.severity}`} dot>{SEV[chosen.severity]}</Badge>
            Severity comes from the rule. The finding is recorded as accepted by you.
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="af-issue" className="text-xs font-medium text-muted">Issue (required)</label>
        <textarea id="af-issue" rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What is wrong with this wording?"
          className="mt-1 w-full resize-y rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-sm placeholder:text-subtle" />
      </div>
      <div>
        <label htmlFor="af-suggestion" className="text-xs font-medium text-muted">Suggested fix (optional)</label>
        <textarea id="af-suggestion" rows={2} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Replacement wording or the disclosure to add"
          className="mt-1 w-full resize-y rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-sm placeholder:text-subtle" />
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding..." : "Add finding"}</Button>
    </form>
  );
}
