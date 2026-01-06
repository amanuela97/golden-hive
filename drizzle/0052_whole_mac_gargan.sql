CREATE TABLE "shipping_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"length_in" numeric(8, 2) NOT NULL,
	"width_in" numeric(8, 2) NOT NULL,
	"height_in" numeric(8, 2) NOT NULL,
	"weight_oz" numeric(8, 2) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "label_file_type" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "label_url" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "label_file_type" text;--> statement-breakpoint
ALTER TABLE "shipping_packages" ADD CONSTRAINT "shipping_packages_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;