import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["marketer", "affiliate", "reviewer", "lead"]);
export const productEnum = pgEnum("product", ["personal_loan", "credit_card", "mortgage_prequal"]);
export const channelEnum = pgEnum("channel", ["email", "social", "display", "affiliate_page", "sms"]);
export const priorityEnum = pgEnum("priority", ["standard", "expedited"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
  "withdrawn",
]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high"]);
export const severityEnum = pgEnum("severity", ["high", "medium", "low"]);
export const findingSourceEnum = pgEnum("finding_source", ["rule", "ai", "reviewer"]);
export const findingStatusEnum = pgEnum("finding_status", ["open", "accepted", "dismissed", "resolved"]);
export const decisionOutcomeEnum = pgEnum("decision_outcome", ["approved", "changes_requested", "rejected"]);
export const analysisStatusEnum = pgEnum("analysis_status", ["pending", "complete", "rules_only", "failed"]);
export const ruleKindEnum = pgEnum("rule_kind", ["phrase", "required", "numeric", "ai"]);

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // e.g. comparison site, blogger, lead-gen, influencer
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull(),
  partnerId: integer("partner_id").references(() => partners.id),
});

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // human-friendly, e.g. CP-1042
    title: text("title").notNull(),
    product: productEnum("product").notNull(),
    channel: channelEnum("channel").notNull(),
    states: text("states").array().notNull().default(sql`'{}'::text[]`),
    launchDate: timestamp("launch_date", { withTimezone: true }),
    priority: priorityEnum("priority").notNull().default("standard"),
    priorityReason: text("priority_reason"),
    notes: text("notes"),
    status: submissionStatusEnum("status").notNull().default("submitted"),
    submitterId: integer("submitter_id").notNull().references(() => users.id),
    partnerId: integer("partner_id").references(() => partners.id),
    assigneeId: integer("assignee_id").references(() => users.id),
    currentVersion: integer("current_version").notNull().default(1),
    riskScore: integer("risk_score").notNull().default(0),
    riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submissions_status_idx").on(t.status), index("submissions_partner_idx").on(t.partnerId)],
);

// One row per submitted revision. Rows are never edited: a resubmission adds a new version.
export const versions = pgTable(
  "versions",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    content: text("content").notNull(), // pasted text, fetched page text, or image transcription
    sourceUrl: text("source_url"),
    assetUrl: text("asset_url"),
    contentHash: text("content_hash").notNull(),
    analysisStatus: analysisStatusEnum("analysis_status").notNull().default("pending"),
    analysisSummary: text("analysis_summary"),
    model: text("model"),
    createdBy: integer("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("versions_submission_number_idx").on(t.submissionId, t.number)],
);

export const findings = pgTable(
  "findings",
  {
    id: serial("id").primaryKey(),
    versionId: integer("version_id").notNull().references(() => versions.id, { onDelete: "cascade" }),
    source: findingSourceEnum("source").notNull(),
    ruleCode: text("rule_code").notNull(),
    severity: severityEnum("severity").notNull(),
    quote: text("quote").notNull(),
    startOffset: integer("start_offset"), // null when the quote could not be anchored in the text
    endOffset: integer("end_offset"),
    issue: text("issue").notNull(),
    suggestion: text("suggestion"),
    confidence: text("confidence"), // low | medium | high — used for sorting only
    status: findingStatusEnum("status").notNull().default("open"),
    dismissReason: text("dismiss_reason"),
    actedBy: integer("acted_by").references(() => users.id),
    actedAt: timestamp("acted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("findings_version_idx").on(t.versionId)],
);

export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  versionId: integer("version_id").notNull().references(() => versions.id),
  reviewerId: integer("reviewer_id").notNull().references(() => users.id),
  outcome: decisionOutcomeEnum("outcome").notNull(),
  note: text("note"),
  feedbackDraft: text("feedback_draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Rules are data, not prompt text: compliance can edit them without touching code.
export const rules = pgTable("rules", {
  code: text("code").primaryKey(), // e.g. REGZ-24-APR
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  severity: severityEnum("severity").notNull(),
  kind: ruleKindEnum("kind").notNull(),
  products: productEnum("products").array().notNull().default(sql`'{}'::product[]`), // empty = all
  channels: channelEnum("channels").array().notNull().default(sql`'{}'::channel[]`), // empty = all
  checkInstruction: text("check_instruction").notNull(), // what the AI should look for
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`), // patterns for deterministic checks
  citation: text("citation").notNull(),
  guidance: text("guidance").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productFacts = pgTable("product_facts", {
  product: productEnum("product").primaryKey(),
  facts: jsonb("facts").notNull(), // advertised APR range, amounts, terms, fees
  approvedSnippets: jsonb("approved_snippets").notNull(), // approved disclosure language
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Insert-only. The app never updates or deletes these rows.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    submissionId: integer("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => users.id), // null = system (e.g. the AI pass)
    action: text("action").notNull(),
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_submission_idx").on(t.submissionId)],
);
