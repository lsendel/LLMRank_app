ALTER TABLE "page_scores" ADD COLUMN "platform_scores" jsonb;
ALTER TABLE "page_scores" ADD COLUMN "recommendations" jsonb;
ALTER TABLE "pages" ADD COLUMN "content_type" text DEFAULT 'unknown';
ALTER TABLE "pages" ADD COLUMN "text_length" integer;
ALTER TABLE "pages" ADD COLUMN "html_length" integer;
