CREATE TYPE "public"."customer_eligibility_type" AS ENUM('all', 'specific');--> statement-breakpoint
CREATE TABLE "discount_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "min_purchase_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "min_purchase_quantity" integer;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "customer_eligibility_type" "customer_eligibility_type" DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_customers" ADD CONSTRAINT "discount_customers_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_customers" ADD CONSTRAINT "discount_customers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;