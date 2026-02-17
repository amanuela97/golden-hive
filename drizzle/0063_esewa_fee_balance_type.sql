-- Add esewa_fee to balance_transaction_type enum (for recording eSewa payment fees in seller_balance_transactions)
ALTER TYPE "balance_transaction_type" ADD VALUE IF NOT EXISTS 'esewa_fee';
