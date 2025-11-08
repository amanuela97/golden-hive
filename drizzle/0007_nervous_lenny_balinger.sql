CREATE TABLE "about_page_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"about_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" varchar(200),
	"description" text
);
--> statement-breakpoint
CREATE TABLE "about_section_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" varchar(200),
	"subtitle" varchar(300),
	"content" text,
	"extra_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "footer_item_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"text" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "footer_section_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" varchar(150) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homepage_about_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"about_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" text,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "homepage_benefit_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benefit_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" text,
	"items" jsonb
);
--> statement-breakpoint
CREATE TABLE "homepage_hero_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hero_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" text,
	"subtitle" text,
	"cta_label" text
);
--> statement-breakpoint
CREATE TABLE "listing_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"locale" varchar(10) NOT NULL,
	"name" text,
	"description" text,
	"tags" text[],
	"origin_village" text
);
--> statement-breakpoint
CREATE TABLE "navbar_item_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"label" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navbar_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"navbar_id" integer NOT NULL,
	"locale" varchar(10) NOT NULL,
	"title" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_billing_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"billing_first_name" text,
	"billing_last_name" text,
	"billing_company" text,
	"billing_country" text,
	"billing_address" text,
	"billing_address_2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_zip" text,
	"billing_phone" text,
	"billing_email" text,
	"shipping_first_name" text,
	"shipping_last_name" text,
	"shipping_company" text,
	"shipping_country" text,
	"shipping_address" text,
	"shipping_address_2" text,
	"shipping_city" text,
	"shipping_state" text,
	"shipping_zip" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_billing_info_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "translations" (
	"lang" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homepage_hero" DROP CONSTRAINT "homepage_hero_order_unique";--> statement-breakpoint
ALTER TABLE "about_page_translations" ADD CONSTRAINT "about_page_translations_about_id_about_page_id_fk" FOREIGN KEY ("about_id") REFERENCES "public"."about_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "about_section_translations" ADD CONSTRAINT "about_section_translations_section_id_about_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."about_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footer_item_translations" ADD CONSTRAINT "footer_item_translations_item_id_footer_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."footer_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footer_section_translations" ADD CONSTRAINT "footer_section_translations_section_id_footer_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."footer_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_about_translations" ADD CONSTRAINT "homepage_about_translations_about_id_homepage_about_id_fk" FOREIGN KEY ("about_id") REFERENCES "public"."homepage_about"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_benefit_translations" ADD CONSTRAINT "homepage_benefit_translations_benefit_id_homepage_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."homepage_benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_hero_translations" ADD CONSTRAINT "homepage_hero_translations_hero_id_homepage_hero_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."homepage_hero"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_translations" ADD CONSTRAINT "listing_translations_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navbar_item_translations" ADD CONSTRAINT "navbar_item_translations_item_id_navbar_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."navbar_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navbar_translations" ADD CONSTRAINT "navbar_translations_navbar_id_navbar_id_fk" FOREIGN KEY ("navbar_id") REFERENCES "public"."navbar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_billing_info" ADD CONSTRAINT "shipping_billing_info_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "about_page" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "about_page" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "about_sections" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "about_sections" DROP COLUMN "subtitle";--> statement-breakpoint
ALTER TABLE "about_sections" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "about_sections" DROP COLUMN "extra_data";--> statement-breakpoint
ALTER TABLE "footer_items" DROP COLUMN "text";--> statement-breakpoint
ALTER TABLE "footer_sections" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "homepage_about" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "homepage_about" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "homepage_benefits" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "homepage_benefits" DROP COLUMN "items";--> statement-breakpoint
ALTER TABLE "homepage_hero" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "homepage_hero" DROP COLUMN "subtitle";--> statement-breakpoint
ALTER TABLE "homepage_hero" DROP COLUMN "cta_label";--> statement-breakpoint
ALTER TABLE "navbar" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "navbar_items" DROP COLUMN "label";