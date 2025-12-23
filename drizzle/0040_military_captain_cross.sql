ALTER TABLE "order_discounts" ALTER COLUMN "discount_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "owner_type" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "owner_id" uuid;