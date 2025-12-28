CREATE TABLE "listing_slug_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"slug_lower" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text,
	"guest_name" text,
	"guest_email" text,
	"rating" integer NOT NULL,
	"title" text,
	"comment" text NOT NULL,
	"order_id" uuid NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_review_order_listing_unique" UNIQUE("order_id","listing_id")
);
--> statement-breakpoint
ALTER TABLE "draft_orders" ALTER COLUMN "draft_number" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "store_review" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "store_review" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "store_review" ALTER COLUMN "order_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "slug_lower" text NOT NULL;--> statement-breakpoint
ALTER TABLE "store_review" ADD COLUMN "guest_name" text;--> statement-breakpoint
ALTER TABLE "store_review" ADD COLUMN "guest_email" text;--> statement-breakpoint
ALTER TABLE "store_review" ADD COLUMN "verified" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_slug_history" ADD CONSTRAINT "listing_slug_history_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_slug_history_unique" ON "listing_slug_history" USING btree ("slug_lower");--> statement-breakpoint
CREATE INDEX "listing_slug_history_listing_idx" ON "listing_slug_history" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "product_review_listing_idx" ON "product_review" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "product_review_store_idx" ON "product_review" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_review_user_idx" ON "product_review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "product_review_order_idx" ON "product_review" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "store_review" ADD CONSTRAINT "store_review_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_slug_lower_unique" ON "listing" USING btree ("slug_lower");--> statement-breakpoint
CREATE INDEX "listing_slug_idx" ON "listing" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "store_review_order_idx" ON "store_review" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "store_review" ADD CONSTRAINT "store_review_order_store_unique" UNIQUE("order_id","store_id");