ALTER TABLE "fulfillments" ADD COLUMN "vendor_fulfillment_status" "order_fulfillment_status" DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "carrier_code" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "tracking_status" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "tracking_data" jsonb;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "last_tracked_at" timestamp;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "easypost_shipment_id" text;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD COLUMN "label_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tracking_token_unique" UNIQUE("tracking_token");