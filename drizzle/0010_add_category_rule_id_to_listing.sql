-- Add category_rule_id column to listing table
ALTER TABLE "listing" ADD COLUMN "category_rule_id" uuid;
-- Add foreign key constraint
ALTER TABLE "listing" ADD CONSTRAINT "listing_category_rule_id_category_rules_id_fk" FOREIGN KEY ("category_rule_id") REFERENCES "public"."category_rules"("id") ON DELETE cascade ON UPDATE no action;
-- Make it required (since DB is empty, this is safe)
ALTER TABLE "listing" ALTER COLUMN "category_rule_id" SET NOT NULL;

