CREATE TYPE "public"."balance_transaction_type" AS ENUM('order_payment', 'platform_fee', 'stripe_fee', 'shipping_label', 'refund', 'dispute', 'payout', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('held', 'transferred', 'pending_payout');--> statement-breakpoint
CREATE TABLE "seller_balance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"type" "balance_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"order_id" uuid,
	"order_payment_id" uuid,
	"order_shipment_id" uuid,
	"payout_id" uuid,
	"balance_before" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"available_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pending_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"last_payout_at" timestamp,
	"last_payout_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seller_balances_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
CREATE TABLE "seller_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" text,
	"stripe_payout_id" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"requested_by" text,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "transfer_status" "transfer_status" DEFAULT 'held' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_payments" ADD COLUMN "stripe_transfer_id" text;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "label_cost_cents" integer;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "label_cost_deducted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_shipments" ADD COLUMN "deducted_at" timestamp;--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD CONSTRAINT "seller_balance_transactions_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD CONSTRAINT "seller_balance_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD CONSTRAINT "seller_balance_transactions_order_payment_id_order_payments_id_fk" FOREIGN KEY ("order_payment_id") REFERENCES "public"."order_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD CONSTRAINT "seller_balance_transactions_order_shipment_id_order_shipments_id_fk" FOREIGN KEY ("order_shipment_id") REFERENCES "public"."order_shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD CONSTRAINT "seller_balance_transactions_payout_id_seller_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."seller_payouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balances" ADD CONSTRAINT "seller_balances_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_balance_transactions_store_idx" ON "seller_balance_transactions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "seller_balance_transactions_order_idx" ON "seller_balance_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "seller_balance_transactions_type_idx" ON "seller_balance_transactions" USING btree ("type");