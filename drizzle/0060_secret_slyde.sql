ALTER TABLE "chat_rooms" ADD COLUMN "buyer_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD COLUMN "seller_deleted" boolean DEFAULT false NOT NULL;