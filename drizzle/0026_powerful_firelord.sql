ALTER TABLE "customers" RENAME COLUMN "vendor_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "draft_orders" RENAME COLUMN "vendor_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "fulfillments" RENAME COLUMN "vendor_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "inventory_locations" RENAME COLUMN "vendor_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "listing" RENAME COLUMN "vendor_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "vendor_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_vendor_id_email_unique";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_vendor_id_store_id_fk";
--> statement-breakpoint
ALTER TABLE "draft_orders" DROP CONSTRAINT "draft_orders_vendor_id_store_id_fk";
--> statement-breakpoint
ALTER TABLE "fulfillments" DROP CONSTRAINT "fulfillments_vendor_id_store_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_locations" DROP CONSTRAINT "inventory_locations_vendor_id_store_id_fk";
--> statement-breakpoint
ALTER TABLE "listing" DROP CONSTRAINT "listing_vendor_id_store_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_vendor_id_store_id_fk";
--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_email_unique" UNIQUE("store_id","email");