ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "country" text;