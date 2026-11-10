ALTER TABLE "games" ADD COLUMN "is_expansion" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "base_game_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "standalone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_base_game_id_games_id_fk" FOREIGN KEY ("base_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_base_game_idx" ON "games" USING btree ("base_game_id");