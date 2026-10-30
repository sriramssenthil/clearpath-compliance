import { PRIMARY_DEMO_EMAIL, type Role } from "@/lib/seed/people";

export type { Role };

/** Pure module (no server imports) so client components can use it. */

export type NavKey = "submissions" | "new" | "queue" | "dashboard" | "rules" | "team";

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
}

export interface Persona {
  role: Role;
  /** Short role name, used in badges and the switcher. */
  label: string;
  /** Who this person is in the story. */
  description: string;
  /** What to try first as this persona. */
  tryThis: string;
  /** Where the persona lands after choosing it. */
  defaultRoute: string;
  navKeys: readonly NavKey[];
  primaryEmail: string;
}

export const ROLES: readonly Role[] = ["marketer", "affiliate", "reviewer", "lead"];

export const PERSONAS: Record<Role, Persona> = {
  marketer: {
    role: "marketer",
    label: "Marketer",
    description: "In-house growth and lifecycle marketer who ships email, social and display for ClearPath's loans and cards.",
    tryThis: "Paste a draft, run the pre-check, and fix what it flags before compliance ever sees it.",
    defaultRoute: "/submissions",
    navKeys: ["submissions", "new"],
    primaryEmail: PRIMARY_DEMO_EMAIL.marketer,
  },
  affiliate: {
    role: "affiliate",
    label: "Affiliate partner",
    description: "Runs a comparison site for an outside partner. Sees only its own partner's submissions.",
    tryThis: "Load the risky example, run the pre-check, submit it, then come back after review to resubmit.",
    defaultRoute: "/submissions/new",
    navKeys: ["submissions", "new"],
    primaryEmail: PRIMARY_DEMO_EMAIL.affiliate,
  },
  reviewer: {
    role: "reviewer",
    label: "Compliance reviewer",
    description: "Works the review queue. Confirms or dismisses cited findings instead of reading every asset from scratch.",
    tryThis: "Open the queue, accept or dismiss each finding, request changes, then approve the revised version from the diff.",
    defaultRoute: "/queue",
    navKeys: ["queue", "submissions", "rules"],
    primaryEmail: PRIMARY_DEMO_EMAIL.reviewer,
  },
  lead: {
    role: "lead",
    label: "Compliance lead",
    description: "Owns policy and answers to regulators. Watches workload and edits the rules the checker uses.",
    tryThis: "Read the dashboard (cycle time, first-pass rate, partner scorecard), then open the rules library.",
    defaultRoute: "/dashboard",
    navKeys: ["dashboard", "queue", "submissions", "rules", "team"],
    primaryEmail: PRIMARY_DEMO_EMAIL.lead,
  },
};

const NAV_BASE: Record<NavKey, { href: string; label: string }> = {
  submissions: { href: "/submissions", label: "Submissions" },
  new: { href: "/submissions/new", label: "New submission" },
  queue: { href: "/queue", label: "Review queue" },
  dashboard: { href: "/dashboard", label: "Dashboard" },
  rules: { href: "/rules", label: "Rules" },
  team: { href: "/team", label: "Team" },
};

export function navFor(role: Role): NavItem[] {
  return PERSONAS[role].navKeys.map((key) => {
    const base = NAV_BASE[key];
    const label = key === "submissions" && (role === "marketer" || role === "affiliate") ? "My submissions" : base.label;
    return { key, href: base.href, label };
  });
}

export function roleLabel(role: Role): string {
  return PERSONAS[role].label;
}

export function canViewAllSubmissions(role: Role): boolean {
  return role === "reviewer" || role === "lead";
}

export function canReview(role: Role): boolean {
  return role === "reviewer" || role === "lead";
}

export function canManageRules(role: Role): boolean {
  return role === "lead";
}
