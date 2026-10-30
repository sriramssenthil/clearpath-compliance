/** One-line human summary of an audit event's `details` JSON. Pure; tolerant of missing or odd values. */

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ANALYSIS_STATUS: Record<string, string> = {
  complete: "rules and AI review",
  rules_only: "rules only, AI unavailable",
  failed: "analysis failed",
};

export function summarizeAuditDetails(action: string, details: Record<string, unknown> | null | undefined): string {
  const d = details ?? {};
  const rule = str(d.ruleCode);
  const version = num(d.versionNumber);
  const note = str(d.note);
  const reason = str(d.reason);
  const parts: string[] = [];

  switch (action) {
    case "submission.created":
      if (version !== null) parts.push(`Version ${version}`);
      if (d.priority === "expedited") parts.push("expedited priority");
      break;
    case "analysis.completed": {
      if (version !== null) parts.push(`Version ${version}`);
      const n = num(d.findings);
      if (n !== null) parts.push(plural(n, "finding"));
      const status = str(d.status);
      if (status) parts.push(ANALYSIS_STATUS[status] ?? status);
      const model = str(d.model);
      if (model) parts.push(model);
      break;
    }
    case "submission.claimed":
      parts.push(d.automatic === true ? "Claimed automatically when a finding was actioned" : "Review claimed");
      break;
    case "finding.accepted":
    case "finding.dismissed":
    case "finding.reopened":
    case "finding.added":
      if (rule) parts.push(rule);
      if (version !== null) parts.push(`version ${version}`);
      if (reason) parts.push(`reason: ${reason}`);
      break;
    case "finding.resolved": {
      if (rule) parts.push(rule);
      const to = num(d.toVersion);
      const from = num(d.fromVersion);
      parts.push(to !== null ? `no longer raised in version ${to}` : "no longer raised");
      if (from !== null) parts.push(`was open in version ${from}`);
      break;
    }
    case "decision.approved":
    case "decision.changes_requested":
    case "decision.rejected": {
      if (version !== null) parts.push(`Version ${version}`);
      const n = num(d.acceptedFindings);
      if (n !== null) parts.push(`${plural(n, "confirmed finding")}`);
      if (note) parts.push(`note: ${note}`);
      break;
    }
    case "submission.resubmitted": {
      if (version !== null) parts.push(`Version ${version}`);
      const n = num(d.resolvedFindings);
      if (n !== null) parts.push(`${plural(n, "earlier finding")} resolved`);
      break;
    }
    case "rule.updated": {
      if (rule) parts.push(rule);
      const changed = Array.isArray(d.changed) ? d.changed.filter((c): c is string => typeof c === "string") : [];
      if (changed.length) parts.push(`changed ${changed.join(", ")}`);
      break;
    }
    default:
      break;
  }
  if (!parts.length) {
    if (rule) parts.push(rule);
    if (version !== null) parts.push(`version ${version}`);
    if (reason) parts.push(`reason: ${reason}`);
    if (note) parts.push(`note: ${note}`);
  }
  const text = parts.join(", ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
