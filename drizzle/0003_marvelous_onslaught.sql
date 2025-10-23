CREATE TYPE "public"."market_type" AS ENUM('local', 'international');--> statement-breakpoint
ALTER TABLE "listing" ALTER COLUMN "is_active" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "market_type" "market_type" DEFAULT 'local';