ALTER TABLE "vendor" RENAME TO "store";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_vendor_id_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "draft_orders" DROP CONSTRAINT "draft_orders_vendor_id_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "fulfillments" DROP CONSTRAINT "fulfillments_vendor_id_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_locations" DROP CONSTRAINT "inventory_locations_vendor_id_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "listing" DROP CONSTRAINT "listing_vendor_id_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_vendor_id_vendor_id_fk";
--> statement-breakpoint
ALTER TABLE "store" DROP CONSTRAINT "vendor_owner_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "store_currency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "unit_system" text NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_vendor_id_store_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_vendor_id_store_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_vendor_id_store_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_vendor_id_store_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_vendor_id_store_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendor_id_store_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."store"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;