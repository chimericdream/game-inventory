ALTER TABLE "games" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "deleted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;