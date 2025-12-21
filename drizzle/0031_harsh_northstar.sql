ALTER TABLE "order_payments" ADD COLUMN "type" text DEFAULT 'payment';--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "stripe_refund_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_amount" numeric(10, 2) DEFAULT '0' NOT NULL;