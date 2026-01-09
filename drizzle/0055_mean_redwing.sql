ALTER TABLE "seller_payout_settings" ADD COLUMN "hold_period_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_payout_settings" ADD COLUMN "next_payout_at" timestamp;