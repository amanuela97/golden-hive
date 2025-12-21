ALTER TABLE "fulfillments" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "fulfilled_by" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "fulfilled_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "fulfilled_quantity" integer DEFAULT 0 NOT NULL;