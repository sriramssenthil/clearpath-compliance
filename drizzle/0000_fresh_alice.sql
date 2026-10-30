CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'complete', 'rules_only', 'failed');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'social', 'display', 'affiliate_page', 'sms');--> statement-breakpoint
CREATE TYPE "public"."decision_outcome" AS ENUM('approved', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."finding_source" AS ENUM('rule', 'ai', 'reviewer');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('open', 'accepted', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('standard', 'expedited');--> statement-breakpoint
CREATE TYPE "public"."product" AS ENUM('personal_loan', 'credit_card', 'mortgage_prequal');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('marketer', 'affiliate', 'reviewer', 'lead');--> statement-breakpoint
CREATE TYPE "public"."rule_kind" AS ENUM('phrase', 'required', 'numeric', 'ai');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'in_review', 'changes_requested', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer,
	"actor_id" integer,
	"action" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"version_id" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"outcome" "decision_outcome" NOT NULL,
	"note" text,
	"feedback_draft" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"source" "finding_source" NOT NULL,
	"rule_code" text NOT NULL,
	"severity" "severity" NOT NULL,
	"quote" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"issue" text NOT NULL,
	"suggestion" text,
	"confidence" text,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"dismiss_reason" text,
	"acted_by" integer,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_facts" (
	"product" "product" PRIMARY KEY NOT NULL,
	"facts" jsonb NOT NULL,
	"approved_snippets" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"severity" "severity" NOT NULL,
	"kind" "rule_kind" NOT NULL,
	"products" "product"[] DEFAULT '{}'::product[] NOT NULL,
	"channels" "channel"[] DEFAULT '{}'::channel[] NOT NULL,
	"check_instruction" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"citation" text NOT NULL,
	"guidance" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"product" "product" NOT NULL,
	"channel" "channel" NOT NULL,
	"states" text[] DEFAULT '{}'::text[] NOT NULL,
	"launch_date" timestamp with time zone,
	"priority" "priority" DEFAULT 'standard' NOT NULL,
	"priority_reason" text,
	"notes" text,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"submitter_id" integer NOT NULL,
	"partner_id" integer,
	"assignee_id" integer,
	"current_version" integer DEFAULT 1 NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_level" "risk_level" DEFAULT 'low' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"partner_id" integer,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"number" integer NOT NULL,
	"content" text NOT NULL,
	"source_url" text,
	"asset_url" text,
	"content_hash" text NOT NULL,
	"analysis_status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"analysis_summary" text,
	"model" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_acted_by_users_id_fk" FOREIGN KEY ("acted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_submission_idx" ON "audit_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "findings_version_idx" ON "findings" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_partner_idx" ON "submissions" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "versions_submission_number_idx" ON "versions" USING btree ("submission_id","number");