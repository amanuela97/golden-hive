import {  NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { extractPublicId } from "@/lib/cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Cleanup endpoint to delete orphaned files from Cloudinary
 * for messages that are marked as deleted but files still exist
 */
export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { roles, userRoles } = await import("@/db/schema");
    const userRole = await db
      .select()
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const isAdmin = userRole.some((r) => r.roles.name.toLowerCase() === "admin");
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Get all deleted messages with media files
    const deletedMessages = await db
      .select({
        id: chatMessages.id,
        mediaUrl: chatMessages.mediaUrl,
        mediaPublicId: chatMessages.mediaPublicId,
        mediaType: chatMessages.mediaType,
      })
      .from(chatMessages)
      .where(eq(chatMessages.isDeleted, true));

    const messagesWithMedia = deletedMessages.filter((msg) => msg.mediaUrl);

    const results = {
      processed: 0,
      deleted: 0,
      failed: 0,
      notFound: 0,
      errors: [] as string[],
    };

    for (const message of messagesWithMedia) {
      results.processed++;
      try {
        let publicId = message.mediaPublicId;

        if (!publicId && message.mediaUrl) {
          publicId = extractPublicId(message.mediaUrl);
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
          
          const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
          });

          if (result.result === "ok") {
            results.deleted++;
            console.log(`[CLEANUP] Deleted: ${publicId}`);
          } else if (result.result === "not found") {
            results.notFound++;
            console.log(`[CLEANUP] Not found (already deleted): ${publicId}`);
          } else {
            results.failed++;
            results.errors.push(
              `Message ${message.id}: Unexpected result "${result.result}" for ${publicId}`
            );
          }
        } else {
          results.failed++;
          results.errors.push(
            `Message ${message.id}: Could not extract public_id from ${message.mediaUrl}`
          );
        }
      } catch (error) {
        results.failed++;
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Unknown error";
        results.errors.push(`Message ${message.id}: ${errorMsg}`);
        console.error(`[CLEANUP] Error processing message ${message.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error in cleanup:", error);
    return NextResponse.json(
      { error: "Failed to cleanup files" },
      { status: 500 }
    );
  }
}
