CREATE TYPE "public"."inventory_event_type" AS ENUM('reserve', 'release', 'fulfill', 'ship', 'restock', 'adjustment', 'return', 'damage');--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD COLUMN "event_type" "inventory_event_type" DEFAULT 'adjustment' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD COLUMN "reference_type" text;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD COLUMN "reference_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD COLUMN "on_hand" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD COLUMN "shipped" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD COLUMN "damaged" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "inventory_levels" ADD COLUMN "returned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_vendor_id_email_unique" UNIQUE("vendor_id","email");