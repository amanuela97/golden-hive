ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "payout_provider" text DEFAULT 'stripe';--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "esewa_id" text;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'stripe';
