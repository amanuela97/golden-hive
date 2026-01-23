import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { chatRooms, store, user, chatMessages } from "@/db/schema";
import { eq, or, desc, ilike, and, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "6");
    const offset = (page - 1) * limit;

    // Check if user is admin (admins see all chats regardless of deletion status)
    const { roles, userRoles } = await import("@/db/schema");
    const userRole = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))
      .limit(1);

    const isAdmin = userRole.some((r) => r.roles.name.toLowerCase() === "admin");

    // Build base conditions
    // For regular users: exclude chats they deleted
    // For admins: show all chats
    let baseCondition;
    if (isAdmin) {
      // Admins see all chats
      baseCondition = or(
        eq(chatRooms.buyerId, userId),
        eq(chatRooms.sellerId, userId)
      );
    } else {
      // Regular users: exclude deleted chats
      baseCondition = and(
        or(
          eq(chatRooms.buyerId, userId),
          eq(chatRooms.sellerId, userId)
        ),
        // If user is buyer, exclude if buyerDeleted is true
        // If user is seller, exclude if sellerDeleted is true
        or(
          and(eq(chatRooms.buyerId, userId), eq(chatRooms.buyerDeleted, false)),
          and(eq(chatRooms.sellerId, userId), eq(chatRooms.sellerDeleted, false))
        )
      );
    }

    // Build search condition if provided
    const searchCondition = search
      ? or(
          ilike(store.storeName, `%${search}%`),
          ilike(user.name, `%${search}%`)
        )
      : undefined;

    // Combine conditions
    const whereCondition = searchCondition
      ? and(baseCondition, searchCondition)
      : baseCondition;

    // Get total count for pagination (without limit/offset)
    const allRooms = await db
      .select({ id: chatRooms.id })
      .from(chatRooms)
      .innerJoin(store, eq(chatRooms.storeId, store.id))
      .innerJoin(user, eq(chatRooms.buyerId, user.id))
      .where(whereCondition);
    const total = allRooms.length;

    // Get paginated rooms
    const rooms = await db
      .select({
        id: chatRooms.id,
        orderId: chatRooms.orderId,
        storeId: chatRooms.storeId,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
        status: chatRooms.status,
        buyerBlocked: chatRooms.buyerBlocked,
        sellerBlocked: chatRooms.sellerBlocked,
        buyerDeleted: chatRooms.buyerDeleted,
        sellerDeleted: chatRooms.sellerDeleted,
        blockedBy: chatRooms.blockedBy,
        storeName: store.storeName,
        storeLogoUrl: store.logoUrl,
        buyerName: user.name,
        buyerImage: user.image,
      })
      .from(chatRooms)
      .innerJoin(store, eq(chatRooms.storeId, store.id))
      .innerJoin(user, eq(chatRooms.buyerId, user.id))
      .where(whereCondition)
      .limit(limit)
      .offset(offset);

    // Get the actual last message for each room
    const roomIds = rooms.map((r) => r.id);
    const lastMessages = roomIds.length > 0
      ? await db
          .select({
            roomId: chatMessages.roomId,
            text: chatMessages.text,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .where(
            and(
              inArray(chatMessages.roomId, roomIds),
              eq(chatMessages.isDeleted, false)
            )
          )
          .orderBy(desc(chatMessages.createdAt))
      : [];

    // Group last messages by roomId and get the most recent for each room
    const lastMessageMap = new Map<string, { text: string | null; createdAt: Date }>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.roomId) || 
          lastMessageMap.get(msg.roomId)!.createdAt < msg.createdAt) {
        lastMessageMap.set(msg.roomId, {
          text: msg.text,
          createdAt: msg.createdAt,
        });
      }
    }

    // Merge last message data into rooms and sort by last message time
    const roomsWithLastMessage = rooms
      .map((room) => {
        const lastMsg = lastMessageMap.get(room.id);
        return {
          ...room,
          lastMessageAt: lastMsg?.createdAt || null,
          lastMessagePreview: lastMsg?.text
            ? lastMsg.text.substring(0, 100)
            : lastMsg
            ? "[Media]"
            : null,
        };
      })
      .sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      });

    return NextResponse.json({
      rooms: roomsWithLastMessage,
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
