CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"data_base64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"partner_id" integer,
	"created_by" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "precedents" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_code" text NOT NULL,
	"product" "product" NOT NULL,
	"channel" "channel" NOT NULL,
	"original_text" text NOT NULL,
	"issue" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"reviewer_comment" text NOT NULL,
	"outcome" text NOT NULL,
	"approved_text" text,
	"decided_at" timestamp with time zone NOT NULL,
	"submission_code" text
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "asset_id" integer;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "input_text" text;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "net_impression" jsonb;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_attempts_email_idx" ON "auth_attempts" USING btree ("email","created_at");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_parent_id_submissions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;