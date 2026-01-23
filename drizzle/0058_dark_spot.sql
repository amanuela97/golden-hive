ALTER TABLE "chat_rooms" ADD COLUMN "buyer_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN "seller_blocked" boolean DEFAULT false NOT NULL;