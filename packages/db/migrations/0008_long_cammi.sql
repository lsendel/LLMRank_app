DROP TABLE "page_facts" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DROP TYPE "public"."fact_type";