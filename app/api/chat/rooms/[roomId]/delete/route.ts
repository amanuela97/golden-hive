import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { chatRooms } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const userId = session.user.id;

    // Get room to check access
    const [room] = await db
      .select({
        id: chatRooms.id,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
        buyerDeleted: chatRooms.buyerDeleted,
        sellerDeleted: chatRooms.sellerDeleted,
      })
      .from(chatRooms)
      .where(eq(chatRooms.id, roomId))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if user is admin (admins cannot delete chats)
    const { roles, userRoles } = await import("@/db/schema");
    const userRole = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))
      .limit(1);

    const isAdmin = userRole.some((r) => r.roles.name.toLowerCase() === "admin");
    if (isAdmin) {
      return NextResponse.json(
        { error: "Admins cannot delete chats" },
        { status: 403 }
      );
    }

    // Check access (must be buyer or seller)
    if (room.buyerId !== userId && room.sellerId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine which field to update
    const isBuyer = room.buyerId === userId;

    // Mark as deleted for this user
    await db
      .update(chatRooms)
      .set({
        ...(isBuyer ? { buyerDeleted: true } : { sellerDeleted: true }),
        updatedAt: new Date(),
      })
      .where(eq(chatRooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId } = await params;
    const userId = session.user.id;

    // Get room to check access
    const [room] = await db
      .select({
        id: chatRooms.id,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
      })
      .from(chatRooms)
      .where(eq(chatRooms.id, roomId))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check access (must be buyer or seller)
    if (room.buyerId !== userId && room.sellerId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine which field to update
    const isBuyer = room.buyerId === userId;

    // Restore chat for this user (set deleted to false)
    await db
      .update(chatRooms)
      .set({
        ...(isBuyer ? { buyerDeleted: false } : { sellerDeleted: false }),
        updatedAt: new Date(),
      })
      .where(eq(chatRooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring chat:", error);
    return NextResponse.json(
      { error: "Failed to restore chat" },
      { status: 500 }
    );
  }
}
