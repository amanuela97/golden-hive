CREATE TABLE "about_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "about_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"about_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200),
	"subtitle" varchar(300),
	"content" text,
	"image_url" varchar(500),
	"extra_data" jsonb,
	"order" integer DEFAULT 0,
	"is_visible" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "footer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"text" varchar(255),
	"href" varchar(255),
	"icon" varchar(100),
	"has_icon" boolean DEFAULT false,
	"list_items" jsonb,
	"order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "footer_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(150) NOT NULL,
	"order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "navbar" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"logo_url" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "navbar_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"navbar_id" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"href" varchar(255) NOT NULL,
	"order" integer DEFAULT 0,
	"requires_auth" boolean DEFAULT false,
	"is_visible" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "about_sections" ADD CONSTRAINT "about_sections_about_id_about_page_id_fk" FOREIGN KEY ("about_id") REFERENCES "public"."about_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footer_items" ADD CONSTRAINT "footer_items_section_id_footer_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."footer_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navbar_items" ADD CONSTRAINT "navbar_items_navbar_id_navbar_id_fk" FOREIGN KEY ("navbar_id") REFERENCES "public"."navbar"("id") ON DELETE cascade ON UPDATE no action;