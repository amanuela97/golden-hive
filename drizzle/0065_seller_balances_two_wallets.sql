-- Two wallets per seller: EUR (Stripe) and NPR (eSewa). One balance row per (store_id, currency).
ALTER TABLE "seller_balances" DROP CONSTRAINT IF EXISTS "seller_balances_store_id_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "seller_balances_store_currency_unique" ON "seller_balances" ("store_id", "currency");
