// Fictional demo data. Every company, person and address here is invented; the .example TLD is reserved
// (RFC 2606) so none of these emails can belong to a real mailbox.

export type Role = "marketer" | "affiliate" | "reviewer" | "lead";

export const PARTNERS = [
  { name: "RateRover", type: "Comparison site" },
  { name: "Cardwell Reviews", type: "Credit card review site" },
  { name: "Ledger & Latte", type: "Personal finance blogger" },
  { name: "LeadHarbor", type: "Lead-gen network" },
  { name: "Money with Mara", type: "Social media influencer" },
  { name: "Dollar Dispatch", type: "Newsletter publisher" },
] as const satisfies readonly { name: string; type: string }[];

export type PartnerName = (typeof PARTNERS)[number]["name"];

/**
 * How each partner's submission history should look when the history seeder runs:
 * "bad" = frequent high-severity findings and rejections, "clean" = mostly first-pass approvals.
 */
export const PARTNER_PROFILE: Record<PartnerName, "bad" | "clean" | "mixed"> = {
  RateRover: "bad",
  "Cardwell Reviews": "clean",
  "Ledger & Latte": "mixed",
  LeadHarbor: "mixed",
  "Money with Mara": "mixed",
  "Dollar Dispatch": "mixed",
};

export interface SeedUser {
  name: string;
  email: string;
  role: Role;
  /** Partner name for affiliate users, null for in-house staff. */
  partnerName: PartnerName | null;
}

export const USERS: readonly SeedUser[] = [
  { name: "Maya Chen", email: "maya.chen@clearpath-demo.example", role: "marketer", partnerName: null },

  { name: "Jordan Ellis", email: "jordan.ellis@raterover.example", role: "affiliate", partnerName: "RateRover" },
  { name: "Amara Singh", email: "amara.singh@cardwell-reviews.example", role: "affiliate", partnerName: "Cardwell Reviews" },
  { name: "Tomas Reyes", email: "tomas.reyes@ledgerandlatte.example", role: "affiliate", partnerName: "Ledger & Latte" },
  { name: "Keiko Tanaka", email: "keiko.tanaka@leadharbor.example", role: "affiliate", partnerName: "LeadHarbor" },
  { name: "Mara Lindqvist", email: "mara.lindqvist@moneywithmara.example", role: "affiliate", partnerName: "Money with Mara" },
  { name: "Owen Gallagher", email: "owen.gallagher@dollardispatch.example", role: "affiliate", partnerName: "Dollar Dispatch" },

  { name: "Priya Raman", email: "priya.raman@clearpath-demo.example", role: "reviewer", partnerName: null },
  { name: "Daniel Okafor", email: "daniel.okafor@clearpath-demo.example", role: "reviewer", partnerName: null },

  { name: "Sofia Alvarez", email: "sofia.alvarez@clearpath-demo.example", role: "lead", partnerName: null },
];

/** The user each persona card on the landing page signs in as. */
export const PRIMARY_DEMO_EMAIL: Record<Role, string> = {
  marketer: "maya.chen@clearpath-demo.example",
  affiliate: "jordan.ellis@raterover.example",
  reviewer: "priya.raman@clearpath-demo.example",
  lead: "sofia.alvarez@clearpath-demo.example",
};
