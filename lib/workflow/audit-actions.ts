/** Every audit_events.action value the app writes. One vocabulary for the service, seed data and UI. */
export const AUDIT = {
  created: "submission.created",
  analysisCompleted: "analysis.completed",
  claimed: "submission.claimed",
  findingAccepted: "finding.accepted",
  findingDismissed: "finding.dismissed",
  findingReopened: "finding.reopened",
  findingAdded: "finding.added",
  findingResolved: "finding.resolved",
  approved: "decision.approved",
  changesRequested: "decision.changes_requested",
  rejected: "decision.rejected",
  resubmitted: "submission.resubmitted",
  withdrawn: "submission.withdrawn",
  ruleUpdated: "rule.updated",
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];

export const AUDIT_LABEL: Record<AuditAction, string> = {
  "submission.created": "Submitted for review",
  "analysis.completed": "Automated check completed",
  "submission.claimed": "Claimed by reviewer",
  "finding.accepted": "Finding accepted",
  "finding.dismissed": "Finding dismissed",
  "finding.reopened": "Finding reopened",
  "finding.added": "Finding added by reviewer",
  "finding.resolved": "Finding resolved in new version",
  "decision.approved": "Approved",
  "decision.changes_requested": "Changes requested",
  "decision.rejected": "Rejected",
  "submission.resubmitted": "New version submitted",
  "submission.withdrawn": "Withdrawn",
  "rule.updated": "Rule updated",
};
