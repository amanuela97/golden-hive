import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { chatMessages, chatRooms } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { extractPublicId } from "@/lib/cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    const userId = session.user.id;

    // Get message
    const [message] = await db
      .select({
        id: chatMessages.id,
        senderId: chatMessages.senderId,
        roomId: chatMessages.roomId,
        mediaUrl: chatMessages.mediaUrl,
        mediaPublicId: chatMessages.mediaPublicId,
        mediaType: chatMessages.mediaType,
      })
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check permission (sender or admin)
    const isAdmin = await checkIsAdmin(userId);
    if (message.senderId !== userId && !isAdmin) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Delete file from Cloudinary if it exists
    if (message.mediaUrl) {
      try {
        // Use stored public_id if available, otherwise extract from URL
        let publicId = message.mediaPublicId;
        
        if (!publicId && message.mediaUrl) {
          // Fallback: extract public_id from Cloudinary URL
          publicId = extractPublicId(message.mediaUrl);
          console.log(`Extracted public_id from URL: ${publicId} (from ${message.mediaUrl})`);
        }
        
        if (publicId) {
          // Determine resource type from mediaType or URL
          let resourceType: "image" | "video" | "raw" = "image"; // Default to image
          
          if (message.mediaType) {
            if (message.mediaType === "image") {
              resourceType = "image";
            } else if (message.mediaType === "video") {
              resourceType = "video";
            } else {
              resourceType = "raw"; // For files
            }
          } else if (message.mediaUrl) {
            // Extract from URL path: /image/upload/, /video/upload/, or /raw/upload/
            if (message.mediaUrl.includes("/video/upload/")) {
              resourceType = "video";
            } else if (message.mediaUrl.includes("/raw/upload/") || message.mediaUrl.includes("/file/upload/")) {
              resourceType = "raw";
            } else {
              resourceType = "image"; // Default
            }
          }
          
          console.log(`[DELETE] Attempting to delete file from Cloudinary. URL: ${message.mediaUrl}, Public ID: ${publicId}, Resource Type: ${resourceType}`);
          
          // Delete from Cloudinary
          const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
          });
          
          console.log(`[DELETE] Cloudinary destroy result:`, JSON.stringify(result, null, 2));
          
          if (result.result === "ok") {
            console.log(`[DELETE] Successfully deleted file from Cloudinary: ${publicId}`);
          } else if (result.result === "not found") {
            console.warn(`[DELETE] File not found in Cloudinary (may have been already deleted): ${publicId}`);
          } else {
            console.warn(`[DELETE] Cloudinary deletion returned unexpected result: ${result.result} for public_id: ${publicId}`);
            console.warn(`[DELETE] Full result:`, JSON.stringify(result, null, 2));
          }
        } else {
          console.error(`[DELETE] Could not find public_id for message. URL: ${message.mediaUrl}, Stored public_id: ${message.mediaPublicId || "null"}`);
        }
      } catch (error) {
        // Log error but don't fail the deletion
        console.error("[DELETE] Error deleting file from Cloudinary:", error);
        if (error instanceof Error) {
          console.error("[DELETE] Error details:", error.message, error.stack);
        }
        // Don't throw - allow message deletion to proceed even if file deletion fails
      }
    }

    // Mark as deleted
    await db
      .update(chatMessages)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
      })
      .where(eq(chatMessages.id, messageId));

    // Recalculate last message for the room
    const [lastMessage] = await db
      .select({
        id: chatMessages.id,
        text: chatMessages.text,
        mediaUrl: chatMessages.mediaUrl,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.roomId, message.roomId),
          eq(chatMessages.isDeleted, false)
        )
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);

    // Update room's last message info
    if (lastMessage) {
      const preview = lastMessage.text
        ? lastMessage.text.substring(0, 100)
        : "[Media]";
      await db
        .update(chatRooms)
        .set({
          lastMessageAt: lastMessage.createdAt,
          lastMessagePreview: preview,
          updatedAt: new Date(),
        })
        .where(eq(chatRooms.id, message.roomId));
    } else {
      // No more messages in the room
      await db
        .update(chatRooms)
        .set({
          lastMessageAt: null,
          lastMessagePreview: null,
          updatedAt: new Date(),
        })
        .where(eq(chatRooms.id, message.roomId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
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
