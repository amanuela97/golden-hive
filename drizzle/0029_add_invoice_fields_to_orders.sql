ALTER TABLE "orders" ADD COLUMN "invoice_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_sent_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_token_unique" UNIQUE("invoice_token");

