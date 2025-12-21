CREATE TYPE "public"."order_workflow_status" AS ENUM('normal', 'in_progress', 'on_hold');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_status" SET DEFAULT 'unfulfilled'::text;--> statement-breakpoint
DROP TYPE "public"."order_fulfillment_status";--> statement-breakpoint
CREATE TYPE "public"."order_fulfillment_status" AS ENUM('unfulfilled', 'partial', 'fulfilled', 'canceled');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_status" SET DEFAULT 'unfulfilled'::"public"."order_fulfillment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_status" SET DATA TYPE "public"."order_fulfillment_status" USING "fulfillment_status"::"public"."order_fulfillment_status";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "workflow_status" "order_workflow_status" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "hold_reason" text;