ALTER TABLE "orders" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_issued_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_pdf_url" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "stripe_onboarding_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "stripe_charges_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "stripe_payouts_enabled" boolean DEFAULT false;