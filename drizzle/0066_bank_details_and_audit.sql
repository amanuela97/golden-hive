-- Store: encrypted bank details for NPR payout alternative
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "bank_details_encrypted" text;

-- Seller payouts: which delivery method was used when admin completed (esewa | bank)
ALTER TABLE "seller_payouts" ADD COLUMN IF NOT EXISTS "payout_delivery_method_used" text;

-- Audit log for sensitive actions (e.g. bank details viewed)
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
