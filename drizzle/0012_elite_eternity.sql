ALTER TABLE "listing" DROP CONSTRAINT "listing_category_rule_id_category_rules_id_fk";
--> statement-breakpoint
ALTER TABLE "listing" ALTER COLUMN "category_rule_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_category_rule_id_category_rules_id_fk" FOREIGN KEY ("category_rule_id") REFERENCES "public"."category_rules"("id") ON DELETE set null ON UPDATE no action;