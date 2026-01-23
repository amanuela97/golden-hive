import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { chatRooms, chatMessages, user, orders, store } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const orderId = searchParams.get("orderId");
    const roomId = searchParams.get("roomId");

    // If roomId is provided, get messages for that room
    if (roomId) {
      const [room] = await db
        .select({
          id: chatRooms.id,
          orderId: chatRooms.orderId,
          storeId: chatRooms.storeId,
          buyerId: chatRooms.buyerId,
          sellerId: chatRooms.sellerId,
          status: chatRooms.status,
          buyerBlocked: chatRooms.buyerBlocked,
          sellerBlocked: chatRooms.sellerBlocked,
          blockedBy: chatRooms.blockedBy,
          storeName: store.storeName,
        })
        .from(chatRooms)
        .innerJoin(store, eq(chatRooms.storeId, store.id))
        .where(eq(chatRooms.id, roomId))
        .limit(1);

      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }

      // Verify access
      const userId = session.user.id;
      const hasAccess =
        room.buyerId === userId ||
        room.sellerId === userId ||
        (await checkIsAdmin(userId));

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Get messages with read status
      const messages = await db
        .select({
          id: chatMessages.id,
          text: chatMessages.text,
          mediaUrl: chatMessages.mediaUrl,
          mediaType: chatMessages.mediaType,
          senderId: chatMessages.senderId,
          senderRole: chatMessages.senderRole,
          isDeleted: chatMessages.isDeleted,
          readBy: chatMessages.readBy,
          createdAt: chatMessages.createdAt,
          senderName: user.name,
          senderImage: user.image,
          storeName: store.storeName,
        })
        .from(chatMessages)
        .innerJoin(user, eq(chatMessages.senderId, user.id))
        .innerJoin(chatRooms, eq(chatMessages.roomId, chatRooms.id))
        .innerJoin(store, eq(chatRooms.storeId, store.id))
        .where(eq(chatMessages.roomId, room.id))
        .orderBy(desc(chatMessages.createdAt))
        .limit(100); // Last 100 messages

      // Mark messages as read by current user
      const unreadMessages = messages.filter(
        (msg) =>
          msg.senderId !== userId &&
          (!msg.readBy || !msg.readBy.includes(userId))
      );

      if (unreadMessages.length > 0) {
        // Update readBy array for unread messages
        await Promise.all(
          unreadMessages.map(async (msg) => {
            const currentReadBy = msg.readBy || [];
            if (!currentReadBy.includes(userId)) {
              await db
                .update(chatMessages)
                .set({
                  readBy: [...currentReadBy, userId],
                  readAt: new Date(),
                })
                .where(eq(chatMessages.id, msg.id));
            }
          })
        );
      }

      return NextResponse.json({
        roomId: room.id,
        room,
        messages: messages.reverse().map((msg) => ({
          ...msg,
          sender: {
            id: msg.senderId,
            // Show store name for sellers, user name for customers
            name:
              msg.senderRole === "seller"
                ? msg.storeName || "Store"
                : msg.senderName || "Unknown",
            image: msg.senderImage,
          },
          createdAt: msg.createdAt,
          readBy: msg.readBy || [],
        })),
      });
    }

    // If orderId is provided, get room for that order
    if (orderId) {
      const [room] = await db
        .select({
          id: chatRooms.id,
          orderId: chatRooms.orderId,
          storeId: chatRooms.storeId,
          buyerId: chatRooms.buyerId,
          sellerId: chatRooms.sellerId,
          status: chatRooms.status,
          buyerBlocked: chatRooms.buyerBlocked,
          sellerBlocked: chatRooms.sellerBlocked,
          blockedBy: chatRooms.blockedBy,
          storeName: store.storeName,
        })
        .from(chatRooms)
        .innerJoin(orders, eq(chatRooms.orderId, orders.id))
        .innerJoin(store, eq(chatRooms.storeId, store.id))
        .where(eq(chatRooms.orderId, orderId))
        .limit(1);

      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }

      // Verify access
      const userId = session.user.id;
      const hasAccess =
        room.buyerId === userId ||
        room.sellerId === userId ||
        (await checkIsAdmin(userId));

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      return NextResponse.json({
        roomId: room.id,
        room,
      });
    }

    return NextResponse.json(
      { error: "orderId or roomId required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching chat room:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
