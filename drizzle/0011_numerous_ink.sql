CREATE TYPE "public"."listing_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_name" text NOT NULL,
	"logo_url" text,
	"owner_user_id" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "category_documentation" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "category" CASCADE;--> statement-breakpoint
DROP TABLE "category_documentation" CASCADE;--> statement-breakpoint
ALTER TABLE "listing" DROP CONSTRAINT "listing_category_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "category_rule_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "compare_at_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "variants" jsonb;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "status" "listing_status" DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_category_rule_id_category_rules_id_fk" FOREIGN KEY ("category_rule_id") REFERENCES "public"."category_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "listing" DROP COLUMN "is_active";