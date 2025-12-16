CREATE TABLE "draft_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_order_id" uuid NOT NULL,
	"listing_id" uuid,
	"variant_id" uuid,
	"title" text NOT NULL,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"line_subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_number" serial NOT NULL,
	"vendor_id" uuid,
	"customer_id" uuid,
	"customer_email" text,
	"customer_first_name" text,
	"customer_last_name" text,
	"currency" text NOT NULL,
	"subtotal_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"shipping_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_status" "order_payment_status" DEFAULT 'pending' NOT NULL,
	"shipping_name" text,
	"shipping_phone" text,
	"shipping_address_line_1" text,
	"shipping_address_line_2" text,
	"shipping_city" text,
	"shipping_region" text,
	"shipping_postal_code" text,
	"shipping_country" text,
	"billing_name" text,
	"billing_phone" text,
	"billing_address_line_1" text,
	"billing_address_line_2" text,
	"billing_city" text,
	"billing_region" text,
	"billing_postal_code" text,
	"billing_country" text,
	"notes" text,
	"shipping_method" text,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"converted_to_order_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draft_order_items" ADD CONSTRAINT "draft_order_items_draft_order_id_draft_orders_id_fk" FOREIGN KEY ("draft_order_id") REFERENCES "public"."draft_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_order_items" ADD CONSTRAINT "draft_order_items_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_order_items" ADD CONSTRAINT "draft_order_items_variant_id_listing_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."listing_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_converted_to_order_id_orders_id_fk" FOREIGN KEY ("converted_to_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;