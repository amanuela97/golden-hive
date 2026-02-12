ALTER TABLE "seller_payouts" ADD COLUMN "provider" text DEFAULT 'stripe';--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "payout_provider" text DEFAULT 'stripe';--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "esewa_id" text;