ALTER TABLE "draft_orders" ADD COLUMN "invoice_token" text;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD COLUMN "invoice_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD COLUMN "invoice_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD COLUMN "invoice_sent_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "platform_fee_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "net_amount_to_store" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_invoice_token_unique" UNIQUE("invoice_token");