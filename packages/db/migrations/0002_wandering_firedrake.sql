CREATE TYPE "public"."integration_provider" AS ENUM('gsc', 'psi', 'ga4', 'clarity');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('succeeded', 'pending', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "custom_extractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"selector" text NOT NULL,
	"attribute" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"crawler_requests" integer DEFAULT 0 NOT NULL,
	"unique_ips" integer DEFAULT 0 NOT NULL,
	"summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_enrichments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"stripe_invoice_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" "payment_status" DEFAULT 'succeeded' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "plan_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_code" text NOT NULL,
	"old_price_cents" integer NOT NULL,
	"new_price_cents" integer NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"encrypted_credentials" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "share_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD COLUMN "shared_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_extractors" ADD CONSTRAINT "custom_extractors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_uploads" ADD CONSTRAINT "log_uploads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_uploads" ADD CONSTRAINT "log_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_enrichments" ADD CONSTRAINT "page_enrichments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_enrichments" ADD CONSTRAINT "page_enrichments_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price_history" ADD CONSTRAINT "plan_price_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_extractors_project" ON "custom_extractors" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_log_uploads_project" ON "log_uploads" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_enrichments_page" ON "page_enrichments" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_enrichments_job_provider" ON "page_enrichments" USING btree ("job_id","provider");--> statement-breakpoint
CREATE INDEX "idx_payments_user" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payments_subscription" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_price_history_plan" ON "plan_price_history" USING btree ("plan_code");--> statement-breakpoint
CREATE INDEX "idx_proj_integrations_project" ON "project_integrations" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_proj_integrations_unique" ON "project_integrations" USING btree ("project_id","provider");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_stripe" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_share_token" ON "crawl_jobs" USING btree ("share_token");--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id");