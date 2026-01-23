import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  chatMessages,
  chatRooms,
  user,
  chatRoomParticipants,
  store,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { roomId, text, mediaUrl, mediaType, mediaFileName, publicId } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    if (!text && !mediaUrl) {
      return NextResponse.json(
        { error: "Message text or media is required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Verify access and get room with store info
    const [room] = await db
      .select({
        id: chatRooms.id,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
        storeId: chatRooms.storeId,
        status: chatRooms.status,
        storeName: store.storeName,
      })
      .from(chatRooms)
      .innerJoin(store, eq(chatRooms.storeId, store.id))
      .where(eq(chatRooms.id, roomId))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const hasAccess =
      room.buyerId === userId ||
      room.sellerId === userId ||
      (await checkIsAdmin(userId));

    if (!hasAccess) {
      // Check participants
      const [participant] = await db
        .select()
        .from(chatRoomParticipants)
        .where(
          and(
            eq(chatRoomParticipants.roomId, roomId),
            eq(chatRoomParticipants.userId, userId)
          )
        )
        .limit(1);

      if (!participant) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    if (room.status === "blocked") {
      return NextResponse.json({ error: "Chat is blocked" }, { status: 403 });
    }

    // Determine sender role
    let senderRole: "customer" | "seller" | "admin" = "customer";
    if (room.buyerId === userId) {
      senderRole = "customer";
    } else if (room.sellerId === userId) {
      senderRole = "seller";
    } else if (await checkIsAdmin(userId)) {
      senderRole = "admin";
    }

    // Save message
    const [message] = await db
      .insert(chatMessages)
      .values({
        roomId,
        senderId: userId,
        senderRole,
        text: text || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaFileName: mediaFileName || null,
        mediaPublicId: publicId || null,
      })
      .returning();

    // Restore chat if it was deleted by the recipient
    // If sender is buyer, restore for seller (if seller deleted it)
    // If sender is seller, restore for buyer (if buyer deleted it)
    const recipientIsBuyer = room.buyerId !== userId;

    // Update room's last message and restore if deleted
    await db
      .update(chatRooms)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: text?.substring(0, 100) || "[Media]",
        ...(recipientIsBuyer ? { buyerDeleted: false } : { sellerDeleted: false }), // Restore chat for recipient if they deleted it
        updatedAt: new Date(),
      })
      .where(eq(chatRooms.id, roomId));

    // Get sender info
    const [sender] = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // Determine display name: store name for sellers, user name for customers
    const displayName =
      senderRole === "seller"
        ? room.storeName || "Store"
        : sender?.name || session.user.name || "Unknown";

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        sender: {
          id: userId,
          name: displayName,
          image: sender?.image || null,
        },
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

async function checkIsAdmin(userId: string): Promise<boolean> {
  const { roles, userRoles } = await import("@/db/schema");
  const userRole = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .limit(1);

  return userRole.some((r) => r.roles.name.toLowerCase() === "admin");
}
