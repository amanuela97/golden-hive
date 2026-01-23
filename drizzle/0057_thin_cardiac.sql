ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_order_store_unique";--> statement-breakpoint
ALTER TABLE "chat_rooms" DROP CONSTRAINT "chat_rooms_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_rooms" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_buyer_store_unique" UNIQUE("buyer_id","store_id");