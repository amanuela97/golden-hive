import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Check if a file is an image by MIME type and/or file extension
 */
function isImageFile(file: File | Blob): boolean {
  // Check MIME type first
  const fileType = file instanceof File ? file.type : "";
  if (fileType.startsWith("image/")) {
    return true;
  }

  // Fallback: check file extension if MIME type is missing or generic
  if (file instanceof File && file.name) {
    const fileName = file.name.toLowerCase();
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
      ".ico",
      ".tiff",
      ".tif",
    ];
    return imageExtensions.some((ext) => fileName.endsWith(ext));
  }

  return false;
}

/**
 * Check if a buffer contains image data by checking magic bytes
 */
function isImageBuffer(buffer: Buffer): boolean {
  // Check for common image file signatures (magic bytes)
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }

  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return true;
  }

  // WebP: Check for "RIFF" header and "WEBP" format
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return true;
  }

  return false;
}

/**
 * Compress image using Sharp
 * @param buffer - Image buffer
 * @param mimeType - Original MIME type
 * @returns Compressed image buffer
 */
async function compressImage(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer> {
  try {
    let sharpInstance = sharp(buffer);

    // Get image metadata
    const metadata = await sharpInstance.metadata();

    // Determine output format based on original format
    // Prefer WebP for better compression, fallback to original format
    const outputFormat = mimeType.includes("png")
      ? "png"
      : mimeType.includes("gif")
        ? "gif"
        : "webp";

    // Resize if image is too large (max width 2000px, maintain aspect ratio)
    if (metadata.width && metadata.width > 2000) {
      sharpInstance = sharpInstance.resize(2000, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    }

    // Compress based on format
    if (outputFormat === "webp") {
      return await sharpInstance.webp({ quality: 85, effort: 6 }).toBuffer();
    } else if (outputFormat === "png") {
      return await sharpInstance
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();
    } else if (outputFormat === "gif") {
      // GIF compression is limited, just optimize
      return await sharpInstance.gif().toBuffer();
    } else {
      // JPEG or other formats - convert to WebP for better compression
      return await sharpInstance.webp({ quality: 85, effort: 6 }).toBuffer();
    }
  } catch (error) {
    console.error("Error compressing image:", error);
    // Return original buffer if compression fails
    return buffer;
  }
}

/**
 * Upload a single file to Cloudinary and return full result
 * @param file - File or Blob to upload
 * @param folder - Cloudinary folder path
 * @returns Promise<CloudinaryUploadResult> - Full Cloudinary upload result
 */
export async function uploadFileWithResult(
  file: File | Blob,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  try {
    // Validate Cloudinary configuration
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        "Cloudinary configuration is missing. Please check your environment variables."
      );
    }

    // Validate file
    if (!file || file.size === 0) {
      throw new Error("Invalid file provided");
    }
    const fileName = (file as File).name || "unnamed";
    const fileType =
      file instanceof File ? file.type : "application/octet-stream";
    console.log(
      `Uploading file: ${fileName}, size: ${file.size}, type: ${fileType}`
    );

    // Convert File/Blob to buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(new Uint8Array(arrayBuffer));
    const originalSize = buffer.length;

    // Always attempt compression for image files
    // Check by MIME type, file extension, and magic bytes for maximum reliability
    const isImage = isImageFile(file) || isImageBuffer(buffer);

    if (isImage) {
      try {
        console.log(
          `[Compression] Compressing image: ${fileName} (${originalSize} bytes)`
        );
        const compressedBuffer = await compressImage(buffer, fileType);
        buffer = compressedBuffer;
        const compressedSize = buffer.length;
        const compressionRatio = (
          (1 - compressedSize / originalSize) *
          100
        ).toFixed(1);
        console.log(
          `[Compression] ✅ Image compressed: ${originalSize} bytes -> ${compressedSize} bytes (${compressionRatio}% reduction)`
        );
      } catch (error) {
        console.warn(
          "[Compression] ⚠️ Failed to compress image, using original:",
          error
        );
        // Continue with original buffer if compression fails
      }
    } else {
      console.log(
        `[Compression] Skipping compression for non-image file: ${fileName}`
      );
    }

    // Convert buffer to base64 data URI
    const base64 = buffer.toString("base64");
    // Use WebP MIME type if image was compressed to WebP, otherwise use original
    const mimeType =
      isImage && buffer.length < originalSize ? "image/webp" : fileType;
    const dataURI = `data:${mimeType};base64,${base64}`;

    console.log(`Uploading to folder: golden-hive/${folder}`);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `golden-hive/${folder}`,
      resource_type: "auto", // Automatically detect image, video, or audio
      quality: "auto",
      fetch_format: "auto",
    });

    console.log(`Upload successful: ${result.secure_url}`);
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      cloudinaryConfig: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? "set" : "missing",
        apiKey: process.env.CLOUDINARY_API_KEY ? "set" : "missing",
        apiSecret: process.env.CLOUDINARY_API_SECRET ? "set" : "missing",
      },
    });
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Upload a single file to Cloudinary
 * @param file - File or Blob to upload
 * @param folder - Cloudinary folder path
 * @returns Promise<string> - Secure URL of uploaded file
 */
export async function uploadFile(
  file: File | Blob,
  folder: string
): Promise<string> {
  try {
    // Validate Cloudinary configuration
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        "Cloudinary configuration is missing. Please check your environment variables."
      );
    }

    // Validate file
    if (!file || file.size === 0) {
      throw new Error("Invalid file provided");
    }
    const fileName = (file as File).name || "unnamed";
    const fileType =
      file instanceof File ? file.type : "application/octet-stream";
    console.log(
      `Uploading file: ${fileName}, size: ${file.size}, type: ${fileType}`
    );

    // Convert File/Blob to buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(new Uint8Array(arrayBuffer));
    const originalSize = buffer.length;

    // Always attempt compression for image files
    // Check by MIME type, file extension, and magic bytes for maximum reliability
    const isImage = isImageFile(file) || isImageBuffer(buffer);

    if (isImage) {
      try {
        console.log(
          `[Compression] Compressing image: ${fileName} (${originalSize} bytes)`
        );
        const compressedBuffer = await compressImage(buffer, fileType);
        buffer = compressedBuffer;
        const compressedSize = buffer.length;
        const compressionRatio = (
          (1 - compressedSize / originalSize) *
          100
        ).toFixed(1);
        console.log(
          `[Compression] ✅ Image compressed: ${originalSize} bytes -> ${compressedSize} bytes (${compressionRatio}% reduction)`
        );
      } catch (error) {
        console.warn(
          "[Compression] ⚠️ Failed to compress image, using original:",
          error
        );
        // Continue with original buffer if compression fails
      }
    } else {
      console.log(
        `[Compression] Skipping compression for non-image file: ${fileName}`
      );
    }

    // Convert buffer to base64 data URI
    const base64 = buffer.toString("base64");
    // Use WebP MIME type if image was compressed to WebP, otherwise use original
    const mimeType =
      isImage && buffer.length < originalSize ? "image/webp" : fileType;
    const dataURI = `data:${mimeType};base64,${base64}`;

    console.log(`Uploading to folder: golden-hive/${folder}`);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `golden-hive/${folder}`,
      resource_type: "auto", // Automatically detect image, video, or audio
      quality: "auto",
      fetch_format: "auto",
    });

    console.log(`Upload successful: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      cloudinaryConfig: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? "set" : "missing",
        apiKey: process.env.CLOUDINARY_API_KEY ? "set" : "missing",
        apiSecret: process.env.CLOUDINARY_API_SECRET ? "set" : "missing",
      },
    });
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Upload multiple files to Cloudinary
 * @param files - Array of Files or Blobs to upload
 * @param folder - Cloudinary folder path
 * @returns Promise<string[]> - Array of secure URLs
 */
export async function uploadFiles(
  files: File[] | Blob[],
  folder: string
): Promise<string[]> {
  try {
    const uploadPromises = files.map((file) => uploadFile(file, folder));
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error("Error uploading files to Cloudinary:", error);
    throw new Error(
      `Failed to upload files: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete a file from Cloudinary by URL
 * @param url - Cloudinary URL to delete
 * @param folder - Cloudinary folder path
 * @returns Promise<boolean> - Success status
 */
export async function deleteFile(
  url: string,
  folder: string
): Promise<boolean> {
  try {
    // Extract public_id from URL
    const publicId = extractPublicId(url);
    if (!publicId) {
      throw new Error("Invalid Cloudinary URL");
    }

    const result = await cloudinary.uploader.destroy(
      `golden-hive/${folder}/${publicId}`
    );
    return result.result === "ok";
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    return false;
  }
}

/**
 * Delete a file from Cloudinary by public_id
 * @param publicId - Cloudinary public_id to delete
 * @returns Promise<boolean> - Success status
 */
export async function deleteFileByPublicId(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    return false;
  }
}

/**
 * Delete multiple files from Cloudinary by URLs
 * @param urls - Array of Cloudinary URLs to delete
 * @returns Promise<boolean> - Success status
 */
export async function deleteFiles(urls: string[]): Promise<boolean> {
  try {
    const publicIds = urls.map((url) => extractPublicId(url)).filter(Boolean);
    if (publicIds.length === 0) {
      return true;
    }

    const result = await cloudinary.api.delete_resources(publicIds as string[]);
    return result.deleted && Object.keys(result.deleted).length > 0;
  } catch (error) {
    console.error("Error deleting files from Cloudinary:", error);
    return false;
  }
}

/**
 * Delete multiple files from Cloudinary by public_ids
 * @param publicIds - Array of Cloudinary public_ids to delete
 * @returns Promise<boolean> - Success status
 */
export async function deleteFilesByPublicIds(
  publicIds: (string | null)[]
): Promise<boolean> {
  try {
    const validPublicIds = publicIds.filter((id): id is string => id !== null);
    if (validPublicIds.length === 0) {
      return true;
    }

    const result = await cloudinary.api.delete_resources(validPublicIds);
    return result.deleted && Object.keys(result.deleted).length > 0;
  } catch (error) {
    console.error("Error deleting files from Cloudinary:", error);
    return false;
  }
}

/**
 * Extract public_id from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns string | null - Public ID or null if invalid
 */
export function extractPublicId(url: string): string | null {
  try {
    // Example URL: https://res.cloudinary.com/demo/image/upload/v1728402325/folder/subfolder/sample.jpg
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    // Extract everything after "/upload/" and remove version part (e.g. v123456789)
    const path = url.substring(uploadIndex + 8); // 8 = "/upload/".length
    const parts = path.split("/");
    const versionPart = parts[0].match(/^v\d+$/) ? 1 : 0;
    const pathAfterVersion = parts.slice(versionPart).join("/");

    // Remove file extension (.jpg, .png, etc.)
    const publicId = pathAfterVersion.replace(/\.[^/.]+$/, "");

    return publicId;
  } catch {
    return null;
  }
}
