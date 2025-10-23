CREATE TABLE "category_documentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"documentation_type_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentation_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"example_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_documentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" text NOT NULL,
	"documentation_type_id" uuid NOT NULL,
	"document_url" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"status" text DEFAULT 'pending',
	"submitted_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_seller_doc" UNIQUE("seller_id","documentation_type_id")
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "requires_documentation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "documentation_description" text;--> statement-breakpoint
ALTER TABLE "category_documentation" ADD CONSTRAINT "category_documentation_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_documentation" ADD CONSTRAINT "category_documentation_documentation_type_id_documentation_type_id_fk" FOREIGN KEY ("documentation_type_id") REFERENCES "public"."documentation_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_documentation" ADD CONSTRAINT "seller_documentation_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_documentation" ADD CONSTRAINT "seller_documentation_documentation_type_id_documentation_type_id_fk" FOREIGN KEY ("documentation_type_id") REFERENCES "public"."documentation_type"("id") ON DELETE cascade ON UPDATE no action;