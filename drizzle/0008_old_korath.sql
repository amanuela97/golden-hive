CREATE TABLE "faq_item_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"question" varchar(500) NOT NULL,
	"answer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_section_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "faq_sections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "faq_item_translations" ADD CONSTRAINT "faq_item_translations_item_id_faq_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."faq_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_section_id_faq_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."faq_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_section_translations" ADD CONSTRAINT "faq_section_translations_section_id_faq_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."faq_sections"("id") ON DELETE cascade ON UPDATE no action;