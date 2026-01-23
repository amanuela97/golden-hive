"use server";

import { db } from "@/db";
import {
  chatRooms,
  chatRoomParticipants,
  chatMessages,
  storeMembers,
  orders,
  orderItems,
  store,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Ensure a chat room exists for a buyer-store combination
 * Creates a room if it doesn't exist, returns existing room if it does
 * If orderId is provided, adds an initial message about the order
 */
export async function ensureChatRoomExists(
  orderId: string | null,
  storeId: string,
  buyerId: string
): Promise<{ roomId: string; created: boolean }> {
  console.log("[CHAT] ensureChatRoomExists called with:", {
    orderId,
    storeId,
    buyerId,
  });

  try {
    // Get seller ID from store (try admin first, then seller, then any member)
    console.log("[CHAT] Looking for store member for storeId:", storeId);

    // First try to get admin
    let [storeMember] = await db
      .select({ userId: storeMembers.userId, role: storeMembers.role })
      .from(storeMembers)
      .where(
        and(eq(storeMembers.storeId, storeId), eq(storeMembers.role, "admin"))
      )
      .limit(1);

    console.log("[CHAT] Store admin query result:", {
      found: !!storeMember,
      userId: storeMember?.userId,
      role: storeMember?.role,
    });

    // If no admin, try seller
    if (!storeMember) {
      console.log("[CHAT] No admin found, trying seller role");
      [storeMember] = await db
        .select({ userId: storeMembers.userId, role: storeMembers.role })
        .from(storeMembers)
        .where(
          and(
            eq(storeMembers.storeId, storeId),
            eq(storeMembers.role, "seller")
          )
        )
        .limit(1);

      console.log("[CHAT] Store seller query result:", {
        found: !!storeMember,
        userId: storeMember?.userId,
        role: storeMember?.role,
      });
    }

    // If still no member, try any member
    if (!storeMember) {
      console.log("[CHAT] No admin or seller found, trying any member");
      [storeMember] = await db
        .select({ userId: storeMembers.userId, role: storeMembers.role })
        .from(storeMembers)
        .where(eq(storeMembers.storeId, storeId))
        .limit(1);

      console.log("[CHAT] Any store member query result:", {
        found: !!storeMember,
        userId: storeMember?.userId,
        role: storeMember?.role,
      });
    }

    if (!storeMember) {
      console.error("[CHAT] ❌ No store member found for storeId:", storeId);
      // Log all members for debugging
      const allMembers = await db
        .select({ userId: storeMembers.userId, role: storeMembers.role })
        .from(storeMembers)
        .where(eq(storeMembers.storeId, storeId));
      console.error("[CHAT] All members for this store:", allMembers);
      throw new Error(`Store seller not found for storeId: ${storeId}`);
    }

    const sellerId = storeMember.userId;
    console.log("[CHAT] Seller ID found:", sellerId);

    // Check if room already exists for this buyer-store combination
    console.log("[CHAT] Checking for existing room:", { buyerId, storeId });
    const existing = await db
      .select()
      .from(chatRooms)
      .where(
        and(eq(chatRooms.buyerId, buyerId), eq(chatRooms.storeId, storeId))
      )
      .limit(1);

    console.log("[CHAT] Existing room check:", {
      found: existing.length > 0,
      roomId: existing[0]?.id,
    });

    if (existing.length > 0) {
      const existingRoom = existing[0];
      console.log("[CHAT] ✅ Room already exists, returning existing room");

      // If orderId is provided, add a message about the new order
      if (orderId) {
        try {
          await addOrderMessageToRoom(existingRoom.id, orderId, sellerId);
        } catch (error) {
          console.error(
            "[CHAT] Error adding order message to existing room:",
            error
          );
        }
      }

      return { roomId: existingRoom.id, created: false };
    }

    // Create new room (orderId can be null for buyer-store rooms)
    console.log("[CHAT] Creating new chat room:", {
      orderId,
      storeId,
      buyerId,
      sellerId,
    });
    const [newRoom] = await db
      .insert(chatRooms)
      .values({
        orderId: orderId || null, // Store first orderId, but room persists across orders
        storeId,
        buyerId,
        sellerId,
        status: "active",
      })
      .returning();

    console.log("[CHAT] ✅ Chat room created:", {
      roomId: newRoom.id,
      orderId: newRoom.orderId,
      storeId: newRoom.storeId,
      buyerId: newRoom.buyerId,
      sellerId: newRoom.sellerId,
    });

    // Add participants
    console.log("[CHAT] Adding participants to room:", {
      roomId: newRoom.id,
      buyerId,
      sellerId,
    });
    await db.insert(chatRoomParticipants).values([
      {
        roomId: newRoom.id,
        userId: buyerId,
        role: "buyer",
      },
      {
        roomId: newRoom.id,
        userId: sellerId,
        role: "seller",
      },
    ]);

    console.log("[CHAT] ✅ Participants added successfully");

    // If orderId is provided, add initial message about the order
    if (orderId) {
      try {
        await addOrderMessageToRoom(newRoom.id, orderId, sellerId);
      } catch (error) {
        console.error("[CHAT] Error adding initial order message:", error);
      }
    }

    return { roomId: newRoom.id, created: true };
  } catch (error) {
    console.error("[CHAT] ❌ Error ensuring chat room exists:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      orderId,
      storeId,
      buyerId,
    });
    throw error;
  }
}

/**
 * Add a message to a chat room about an order
 */
async function addOrderMessageToRoom(
  roomId: string,
  orderId: string,
  sellerId: string
): Promise<void> {
  try {
    // Get order details
    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        storeName: store.storeName,
      })
      .from(orders)
      .innerJoin(store, eq(orders.storeId, store.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      console.error("[CHAT] Order not found for message:", orderId);
      return;
    }

    // Get order items
    const items = await db
      .select({
        title: orderItems.title,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .limit(10); // Limit to first 10 items for message

    // Format order message
    const itemsList = items
      .map((item) => `• ${item.title} (x${item.quantity})`)
      .join("\n");
    const moreItemsText = items.length >= 10 ? "\n... and more items" : "";
    const messageText = `New order received: #${order.orderNumber}\n\nItems:\n${itemsList}${moreItemsText}\n\nTotal: ${order.currency.toUpperCase()} ${parseFloat(order.totalAmount).toFixed(2)}`;

    // Create message
    await db.insert(chatMessages).values({
      roomId,
      senderId: sellerId,
      senderRole: "seller",
      text: messageText,
    });

    // Update room's last message
    await db
      .update(chatRooms)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: messageText.substring(0, 100),
        updatedAt: new Date(),
      })
      .where(eq(chatRooms.id, roomId));

    console.log("[CHAT] ✅ Order message added to room:", roomId);
  } catch (error) {
    console.error("[CHAT] Error adding order message:", error);
    throw error;
  }
}
