CREATE TABLE "refund_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"reason" text NOT NULL,
	"description" text,
	"evidence_images" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "fee_paid_by" text;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "stripe_fee_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_refunds" ADD COLUMN "refund_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_requested_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_request_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_request_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancellation_requested_by_user_id_fk" FOREIGN KEY ("cancellation_requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;