import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
    console.log(
      `Uploading file: ${fileName}, size: ${file.size}, type: ${file.type}`
    );

    // Convert File/Blob to buffer
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataURI = `data:${file.type};base64,${base64}`;

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
    console.log(
      `Uploading file: ${fileName}, size: ${file.size}, type: ${file.type}`
    );

    // Convert File/Blob to buffer
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataURI = `data:${file.type};base64,${base64}`;

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
