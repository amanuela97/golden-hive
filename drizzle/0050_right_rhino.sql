ALTER TABLE "shipping_profiles" DROP CONSTRAINT "shipping_profiles_origin_location_id_inventory_locations_id_fk";
--> statement-breakpoint
ALTER TABLE "shipping_profiles" ADD COLUMN "origin_country" text NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_profiles" ADD COLUMN "origin_postal_code" text;--> statement-breakpoint
ALTER TABLE "shipping_profiles" DROP COLUMN "origin_location_id";