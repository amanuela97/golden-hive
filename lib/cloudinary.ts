import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
    // Convert File/Blob to buffer
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataURI = `data:${file.type};base64,${base64}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: `golden-hive/${folder}`,
      resource_type: "auto", // Automatically detect image, video, or audio
      quality: "auto",
      fetch_format: "auto",
    });

    return result.secure_url;
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);
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
 * Extract public_id from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns string | null - Public ID or null if invalid
 */
function extractPublicId(url: string): string | null {
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
