import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  /** scrypt hash, self-describing ("scrypt$N$r$p$salt$hash", see lib/auth/password.ts). Null for passwordless demo personas. */
  passwordHash: text("password_hash"),
  /** Seeded demo persona: may be entered from the landing page without a password when DEMO_MODE is on. */
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    /** Set when this asset is a variant of an approved master asset (campaign variants). */
    parentId: integer("parent_id").references((): AnyPgColumn => submissions.id),
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
    /** Uploaded image or PDF this version was analysed from (its transcription is part of `content`). */
    assetId: integer("asset_id").references((): AnyPgColumn => assets.id, { onDelete: "set null" }),
    /** Text typed by the submitter, kept separately from any transcription so a resubmission can prefill it. */
    inputText: text("input_text"),
    /** "Reasonable consumer" read of the asset (see lib/compliance/net-impression.ts). */
    netImpression: jsonb("net_impression"),
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
  aiReview: boolean("ai_review").notNull().default(true),
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

// Analysis results keyed by a hash of (content, metadata, rules, model). A pre-check followed by a
// submit of the same text costs one model call, and the demo's example ads respond instantly.
export const analysisCache = pgTable("analysis_cache", {
  key: text("key").primaryKey(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per live model call, used to cap spend on the public demo (see lib/workflow/budget.ts).
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_created_idx").on(t.createdAt)],
);

/** Uploaded ad files. Stored in Postgres (base64) to keep the demo dependency-free; object storage in production. */
export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  mediaType: text("media_type").notNull(), // image/png | image/jpeg | image/webp | image/gif | application/pdf
  filename: text("filename").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  dataBase64: text("data_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Invitations for accounts that cannot self-register (reviewers, leads) or that a lead creates for a partner. */
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(), // sha256 of the token; the raw token is only shown once
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  partnerId: integer("partner_id").references(() => partners.id),
  createdBy: integer("created_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sign-in attempts, for throttling password guessing. */
export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip"),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_attempts_email_idx").on(t.email, t.createdAt)],
);

/** Past compliance decisions used as precedent: what was flagged, what the reviewer said, what wording passed. */
export const precedents = pgTable("precedents", {
  id: serial("id").primaryKey(),
  ruleCode: text("rule_code").notNull(),
  product: productEnum("product").notNull(),
  channel: channelEnum("channel").notNull(),
  originalText: text("original_text").notNull(),
  issue: text("issue").notNull(),
  reviewerName: text("reviewer_name").notNull(),
  reviewerComment: text("reviewer_comment").notNull(),
  outcome: text("outcome").notNull(), // fixed | dismissed | rejected
  approvedText: text("approved_text"),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  submissionCode: text("submission_code"),
});
