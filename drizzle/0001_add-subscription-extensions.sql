ALTER TABLE "extension_refresh_token" ADD COLUMN IF NOT EXISTS "client" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "extensions" text[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "verified_event_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "purchase_event_interval" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "extension_event_pending" boolean DEFAULT false NOT NULL;
