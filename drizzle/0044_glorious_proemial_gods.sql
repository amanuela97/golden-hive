ALTER TABLE "store" ADD COLUMN "is_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_approved_idx" ON "store" USING btree ("is_approved");