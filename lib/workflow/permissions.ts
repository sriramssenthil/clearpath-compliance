import { canDecideFrom, canResubmitFrom, canReview, canWithdrawFrom, type Role, type Status } from "./flow";
import type { Actor, Permissions } from "./types";

interface SubjectFields {
  status: Status;
  submitterId: number;
  partnerId: number | null;
}

/** Marketers act on their own submissions; affiliates on anything from their partner organisation. */
export function isSubmitterSide(actor: Pick<Actor, "id" | "role" | "partnerId">, sub: Pick<SubjectFields, "submitterId" | "partnerId">) {
  if (actor.id === sub.submitterId) return true;
  return actor.role === "affiliate" && actor.partnerId !== null && actor.partnerId === sub.partnerId;
}

export function canView(actor: Pick<Actor, "id" | "role" | "partnerId">, sub: Pick<SubjectFields, "submitterId" | "partnerId">) {
  return canReview(actor.role as Role) || isSubmitterSide(actor, sub);
}

export function permissionsFor(actor: Pick<Actor, "id" | "role" | "partnerId">, sub: SubjectFields): Permissions {
  const reviewer = canReview(actor.role);
  const submitterSide = isSubmitterSide(actor, sub);
  return {
    canClaim: reviewer && sub.status === "submitted",
    canActOnFindings: reviewer && canDecideFrom(sub.status),
    canDecide: reviewer && canDecideFrom(sub.status),
    canResubmit: submitterSide && canResubmitFrom(sub.status),
    canWithdraw: (submitterSide || actor.role === "lead") && canWithdrawFrom(sub.status),
  };
}
