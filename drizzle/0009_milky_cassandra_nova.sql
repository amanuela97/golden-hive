CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taxonomy_category_id" text NOT NULL,
	"requires_documentation" boolean DEFAULT false NOT NULL,
	"documentation_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_rules_taxonomy_category_id_unique" UNIQUE("taxonomy_category_id")
);
--> statement-breakpoint
CREATE TABLE "category_rules_documentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_rule_id" uuid NOT NULL,
	"documentation_type_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "taxonomy_category_id" text;--> statement-breakpoint
ALTER TABLE "category_rules_documentation" ADD CONSTRAINT "category_rules_documentation_category_rule_id_category_rules_id_fk" FOREIGN KEY ("category_rule_id") REFERENCES "public"."category_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules_documentation" ADD CONSTRAINT "category_rules_documentation_documentation_type_id_documentation_type_id_fk" FOREIGN KEY ("documentation_type_id") REFERENCES "public"."documentation_type"("id") ON DELETE cascade ON UPDATE no action;