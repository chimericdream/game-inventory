CREATE TYPE "public"."accessory_kind" AS ENUM('playmat', 'organizer', 'upgraded_components', 'miniatures', 'sleeves', 'other');--> statement-breakpoint
CREATE TABLE "copy_accessories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "accessory_kind" DEFAULT 'other' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"location_id" uuid,
	"acquired_on" date,
	"price_cents" integer,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"created_by_user_id" uuid,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "copy_accessories" ADD CONSTRAINT "copy_accessories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_accessories" ADD CONSTRAINT "copy_accessories_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."copies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_accessories" ADD CONSTRAINT "copy_accessories_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_accessories" ADD CONSTRAINT "copy_accessories_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_accessories" ADD CONSTRAINT "copy_accessories_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copy_accessories" ADD CONSTRAINT "copy_accessories_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "copy_accessories_copy_idx" ON "copy_accessories" USING btree ("copy_id");--> statement-breakpoint
CREATE INDEX "copy_accessories_household_idx" ON "copy_accessories" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "copy_accessories_location_idx" ON "copy_accessories" USING btree ("location_id");