CREATE TYPE "public"."store_visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TABLE "store_about" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_banner_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_follow" (
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_follow_store_id_user_id_pk" PRIMARY KEY("store_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "store_policies" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"shipping" text,
	"returns" text,
	"cancellations" text,
	"custom_orders" text,
	"privacy" text,
	"additional" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text,
	"order_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_slug_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"slug_lower" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "slug_lower" text NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "visibility" "store_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "rating_sum" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "follower_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_about" ADD CONSTRAINT "store_about_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_banner_image" ADD CONSTRAINT "store_banner_image_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_follow" ADD CONSTRAINT "store_follow_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_follow" ADD CONSTRAINT "store_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_policies" ADD CONSTRAINT "store_policies_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_review" ADD CONSTRAINT "store_review_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_review" ADD CONSTRAINT "store_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_slug_history" ADD CONSTRAINT "store_slug_history_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_banner_store_idx" ON "store_banner_image" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_banner_store_order_unique" ON "store_banner_image" USING btree ("store_id","sort_order");--> statement-breakpoint
CREATE INDEX "store_follow_user_idx" ON "store_follow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "store_follow_store_idx" ON "store_follow" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "store_review_store_idx" ON "store_review" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "store_review_user_idx" ON "store_review" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_slug_history_unique" ON "store_slug_history" USING btree ("slug_lower");--> statement-breakpoint
CREATE INDEX "store_slug_history_store_idx" ON "store_slug_history" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_slug_lower_unique" ON "store" USING btree ("slug_lower");--> statement-breakpoint
CREATE INDEX "store_visibility_idx" ON "store" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "store_rating_idx" ON "store" USING btree ("rating_avg");--> statement-breakpoint
CREATE INDEX "store_followers_idx" ON "store" USING btree ("follower_count");