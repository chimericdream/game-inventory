CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"borrower" text NOT NULL,
	"lent_on" date NOT NULL,
	"due_on" date,
	"returned_on" date,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"played_on" date NOT NULL,
	"duration_minutes" integer,
	"player_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"winner" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "game_type" DEFAULT 'board' NOT NULL,
	"url" text,
	"price_cents" integer,
	"notes" text,
	"requested_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loans_household_idx" ON "loans" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "loans_copy_idx" ON "loans" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "plays_household_played_idx" ON "play_sessions" USING btree ("household_id","played_on");--> statement-breakpoint
CREATE INDEX "plays_game_idx" ON "play_sessions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "wishlist_household_idx" ON "wishlist_items" USING btree ("household_id");