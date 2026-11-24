ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "carry_price_id" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "carry_extensions" text[];--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "carry_until" timestamp with time zone;