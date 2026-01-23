import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadFileWithResult } from "@/lib/cloudinary";

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const roomId = formData.get("roomId") as string;
    const userId = session.user.id;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // Validate file size
    const fileType = file.type || "";
    let maxSize = MAX_FILE_SIZE;
    let fileCategory = "file";

    if (fileType.startsWith("image/")) {
      maxSize = MAX_IMAGE_SIZE;
      fileCategory = "image";
    } else if (fileType.startsWith("video/")) {
      maxSize = MAX_VIDEO_SIZE;
      fileCategory = "video";
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      return NextResponse.json(
        {
          error: `File size exceeds the maximum allowed size of ${maxSizeMB}MB for ${fileCategory}s. Please choose a smaller file.`,
        },
        { status: 400 }
      );
    }

    // Determine media type
    let mediaType: "image" | "video" | "file" = "file";
    if (fileType.startsWith("image/")) {
      mediaType = "image";
    } else if (fileType.startsWith("video/")) {
      mediaType = "video";
    }

    // Upload to Cloudinary with folder structure: chat/{roomId}/{userId}/
    const folder = `chat/${roomId}/${userId}`;
    const uploadResult = await uploadFileWithResult(file, folder);

    return NextResponse.json({
      success: true,
      mediaUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      mediaType,
      mediaFileName: file.name,
    });
  } catch (error: unknown) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload file. Please try again.",
      },
      { status: 500 }
    );
  }
}
