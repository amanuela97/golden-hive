CREATE TABLE "homepage_about" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Our Story',
	"content" text,
	"asset_url" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "homepage_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Why Choose Golden Hive?',
	"items" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "homepage_hero" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"title" text,
	"subtitle" text,
	"cta_label" text,
	"cta_link" text,
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "homepage_hero_order_unique" UNIQUE("order")
);
