CREATE TABLE "ats_score_reservation_use" (
	"reservation_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ats_cloud_usage" (
	"user_id" text NOT NULL,
	"period_key" text NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"used" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ats_cloud_usage_user_id_period_key_pk" PRIMARY KEY("user_id","period_key")
);
--> statement-breakpoint
ALTER TABLE "ats_score_reservation_use" ADD CONSTRAINT "ats_score_reservation_use_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ats_cloud_usage" ADD CONSTRAINT "ats_cloud_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;