CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'available', 'paid');--> statement-breakpoint
CREATE TABLE "seller_payout_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"method" text DEFAULT 'manual' NOT NULL,
	"schedule" text,
	"minimum_amount" numeric(10, 2) DEFAULT '20.00' NOT NULL,
	"payout_day_of_week" integer,
	"payout_day_of_month" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seller_payout_settings_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD COLUMN "status" "transaction_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_balance_transactions" ADD COLUMN "available_at" timestamp;--> statement-breakpoint
ALTER TABLE "seller_payout_settings" ADD CONSTRAINT "seller_payout_settings_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;