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

    const userId = session.user.id;
    const { roomId } = await params;

    // Get the room
    const [room] = await db
      .select({
        id: chatRooms.id,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
        buyerBlocked: chatRooms.buyerBlocked,
        sellerBlocked: chatRooms.sellerBlocked,
        status: chatRooms.status,
      })
      .from(chatRooms)
      .where(eq(chatRooms.id, roomId))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify user is a participant
    if (room.buyerId !== userId && room.sellerId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine if user is buyer or seller
    const isBuyer = room.buyerId === userId;
    const isSeller = room.sellerId === userId;

    // Update the appropriate block field
    const updateData: {
      buyerBlocked?: boolean;
      sellerBlocked?: boolean;
      status: "active" | "blocked";
    } = {
      status: "blocked", // Will be recalculated below
    };

    if (isBuyer) {
      updateData.buyerBlocked = true;
    } else if (isSeller) {
      updateData.sellerBlocked = true;
    }

    // Get current state to calculate new status (default to false if undefined)
    const newBuyerBlocked = isBuyer ? true : (room.buyerBlocked ?? false);
    const newSellerBlocked = isSeller ? true : (room.sellerBlocked ?? false);

    // Status is blocked if either user has blocked
    updateData.status =
      newBuyerBlocked || newSellerBlocked ? "blocked" : "active";

    // Block the room
    await db
      .update(chatRooms)
      .set(updateData)
      .where(eq(chatRooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error blocking chat room:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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

    const userId = session.user.id;
    const { roomId } = await params;

    // Get the room
    const [room] = await db
      .select({
        id: chatRooms.id,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
        buyerBlocked: chatRooms.buyerBlocked,
        sellerBlocked: chatRooms.sellerBlocked,
        status: chatRooms.status,
      })
      .from(chatRooms)
      .where(eq(chatRooms.id, roomId))
      .limit(1);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify user is a participant
    if (room.buyerId !== userId && room.sellerId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine if user is buyer or seller
    const isBuyer = room.buyerId === userId;
    const isSeller = room.sellerId === userId;

    // Update the appropriate block field (unblock only the current user's block)
    const updateData: {
      buyerBlocked?: boolean;
      sellerBlocked?: boolean;
      status: "active" | "blocked";
    } = {
      status: "active", // Will be recalculated below
    };

    if (isBuyer) {
      updateData.buyerBlocked = false;
    } else if (isSeller) {
      updateData.sellerBlocked = false;
    }

    // Get new state to calculate status (default to false if undefined)
    const newBuyerBlocked = isBuyer ? false : (room.buyerBlocked ?? false);
    const newSellerBlocked = isSeller ? false : (room.sellerBlocked ?? false);

    // Status is blocked if either user has blocked, active only if both have unblocked
    updateData.status =
      newBuyerBlocked || newSellerBlocked ? "blocked" : "active";

    // Unblock the room
    await db
      .update(chatRooms)
      .set(updateData)
      .where(eq(chatRooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unblocking chat room:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
