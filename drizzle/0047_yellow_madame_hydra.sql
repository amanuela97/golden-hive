CREATE TABLE "order_shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"rate_id" text NOT NULL,
	"carrier" text NOT NULL,
	"service" text NOT NULL,
	"rate" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draft_orders" ADD COLUMN "shipping_carrier" text;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD COLUMN "shipping_service" text;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD COLUMN "shipping_rate_id" text;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "weight_oz" numeric(8, 1) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "length_in" numeric(8, 1) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "width_in" numeric(8, 1) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "height_in" numeric(8, 1) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_service" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_rate_id" text;--> statement-breakpoint
ALTER TABLE "order_shipping_rates" ADD CONSTRAINT "order_shipping_rates_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shipping_rates" ADD CONSTRAINT "order_shipping_rates_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;