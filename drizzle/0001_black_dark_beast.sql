CREATE TYPE "public"."copy_condition" AS ENUM('new', 'good', 'worn', 'damaged', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."copy_format" AS ENUM('physical', 'digital');--> statement-breakpoint
CREATE TYPE "public"."game_type" AS ENUM('board', 'card', 'rpg', 'video', 'puzzle', 'other');--> statement-breakpoint
CREATE TYPE "public"."game_visibility" AS ENUM('normal', 'hide_images', 'hidden_restricted');--> statement-breakpoint
CREATE TABLE "board_game_details" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"min_players" integer,
	"max_players" integer,
	"play_time_minutes" integer,
	"complexity" integer,
	"min_age" integer
);
--> statement-breakpoint
CREATE TABLE "copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"location_id" uuid,
	"format" "copy_format" DEFAULT 'physical' NOT NULL,
	"platform" text,
	"condition" "copy_condition" DEFAULT 'good' NOT NULL,
	"acquired_on" date,
	"price_cents" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "game_tags" (
	"household_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "game_tags_game_id_tag_id_pk" PRIMARY KEY("game_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "game_type" NOT NULL,
	"description" text,
	"cover_image" text,
	"visibility" "game_visibility" DEFAULT 'normal' NOT NULL,
	"shareable" boolean DEFAULT false NOT NULL,
	"notes" text,
	"bgg_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rpg_details" (
	"game_id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"system" text,
	"book_kind" text
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_game_details" ADD CONSTRAINT "board_game_details_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_game_details" ADD CONSTRAINT "board_game_details_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copies" ADD CONSTRAINT "copies_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpg_details" ADD CONSTRAINT "rpg_details_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpg_details" ADD CONSTRAINT "rpg_details_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copies_game_idx" ON "copies" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "copies_household_idx" ON "copies" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "games_household_title_idx" ON "games" USING btree ("household_id","title");--> statement-breakpoint
CREATE INDEX "locations_household_idx" ON "locations" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "tags_household_idx" ON "tags" USING btree ("household_id");