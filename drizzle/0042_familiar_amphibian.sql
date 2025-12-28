CREATE TABLE "listing_favorite" (
	"listing_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listing_favorite_listing_id_user_id_pk" PRIMARY KEY("listing_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "listing_favorite" ADD CONSTRAINT "listing_favorite_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_favorite" ADD CONSTRAINT "listing_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_favorite_user_idx" ON "listing_favorite" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listing_favorite_listing_idx" ON "listing_favorite" USING btree ("listing_id");--> statement-breakpoint
ALTER TABLE "store" DROP COLUMN "description";