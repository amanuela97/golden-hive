import { db } from "@/db";
import { listing, type Listing } from "@/db/schema";

// Re-export the Listing type for use in components
export type { Listing };
import { uploadFile, uploadFiles, deleteFile, deleteFiles } from "./cloudinary";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Types for CRUD operations
export type CreateListingData = {
  name: string;
  description?: string;
  category?: string;
  price: number;
  currency?: string;
  stockQuantity?: number;
  unit?: string;
  producerId: string;
  imageUrl?: string;
  gallery?: string[];
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  originVillage?: string;
  harvestDate?: Date;
  // Media files for upload
  mainImage?: File | Blob;
  galleryFiles?: (File | Blob)[];
};

export type UpdateListingData = Partial<
  Omit<CreateListingData, "producerId">
> & {
  id: string;
};

/**
 * Create a new listing
 */
export async function createListing(data: CreateListingData): Promise<Listing> {
  try {
    // Validate required fields
    if (!data.name || !data.price || !data.producerId) {
      throw new Error("Name, price, and producerId are required");
    }

    let imageUrl = data.imageUrl;
    let gallery = data.gallery || [];

    // Upload main image if provided
    if (data.mainImage) {
      imageUrl = await uploadFile(data.mainImage, "listings/main");
    }

    // Upload gallery images if provided
    if (data.galleryFiles && data.galleryFiles.length > 0) {
      const galleryUrls = await uploadFiles(
        data.galleryFiles,
        "listings/gallery"
      );
      gallery = [...gallery, ...galleryUrls];
    }

    // Create listing in database
    const newListing = await db
      .insert(listing)
      .values({
        id: uuidv4(),
        name: data.name,
        description: data.description,
        category: data.category || null, // Convert empty string to null for UUID field
        price: data.price.toString(),
        currency: data.currency || "NPR",
        stockQuantity: data.stockQuantity || 0,
        unit: data.unit || "kg",
        producerId: data.producerId,
        imageUrl,
        gallery,
        tags: data.tags || [],
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
        originVillage: data.originVillage,
        harvestDate: data.harvestDate,
      })
      .returning();

    return newListing[0];
  } catch (error) {
    console.error("Error creating listing:", error);
    throw new Error(
      `Failed to create listing: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get a single listing by ID
 */
export async function getListingById(id: string): Promise<Listing | null> {
  try {
    const result = await db
      .select()
      .from(listing)
      .where(eq(listing.id, id))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching listing:", error);
    throw new Error(
      `Failed to fetch listing: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get all listings
 */
export async function getListings(): Promise<Listing[]> {
  try {
    const result = await db.select().from(listing).orderBy(listing.createdAt);
    return result;
  } catch (error) {
    console.error("Error fetching listings:", error);
    throw new Error(
      `Failed to fetch listings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get listings by producer ID
 */
export async function getListingsByProducer(
  producerId: string
): Promise<Listing[]> {
  try {
    const result = await db
      .select()
      .from(listing)
      .where(eq(listing.producerId, producerId))
      .orderBy(listing.createdAt);
    return result;
  } catch (error) {
    console.error("Error fetching producer listings:", error);
    throw new Error(
      `Failed to fetch producer listings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Update a listing
 */
export async function updateListing(data: UpdateListingData): Promise<Listing> {
  try {
    const { id, mainImage, galleryFiles, ...updateData } = data;

    // Get existing listing
    const existingListing = await getListingById(id);
    if (!existingListing) {
      throw new Error("Listing not found");
    }

    let imageUrl = updateData.imageUrl || existingListing.imageUrl;
    let gallery = updateData.gallery || existingListing.gallery || [];

    // Handle main image update
    if (mainImage) {
      // Delete old main image if it exists
      if (existingListing.imageUrl) {
        await deleteFile(existingListing.imageUrl, "listings/main");
      }
      // Upload new main image
      imageUrl = await uploadFile(mainImage, "listings/main");
    }

    // Handle gallery images update
    if (galleryFiles && galleryFiles.length > 0) {
      // Upload new gallery images
      const newGalleryUrls = await uploadFiles(
        galleryFiles,
        "listings/gallery"
      );
      gallery = [...gallery, ...newGalleryUrls];
    }

    const updatedListing = await db
      .update(listing)
      .set({
        ...updateData,
        category: updateData.category || null, // Convert empty string to null for UUID field
        imageUrl: imageUrl || undefined,
        gallery,
        tags: updateData.tags || [],
        updatedAt: new Date(),
        price: updateData.price ? String(updateData.price) : undefined,
      })
      .where(eq(listing.id, id))
      .returning();

    return updatedListing[0];
  } catch (error) {
    console.error("Error updating listing:", error);
    throw new Error(
      `Failed to update listing: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete a listing
 */
export async function deleteListing(id: string): Promise<boolean> {
  try {
    // Get existing listing to clean up media files
    const existingListing = await getListingById(id);
    if (!existingListing) {
      throw new Error("Listing not found");
    }

    // Delete media files from Cloudinary
    const urlsToDelete: string[] = [];

    if (existingListing.imageUrl) {
      urlsToDelete.push(existingListing.imageUrl);
    }

    if (existingListing.gallery && existingListing.gallery.length > 0) {
      urlsToDelete.push(...existingListing.gallery);
    }

    // Delete files from Cloudinary
    if (urlsToDelete.length > 0) {
      await deleteFiles(urlsToDelete);
    }

    // Delete listing from database
    await db.delete(listing).where(eq(listing.id, id));

    return true;
  } catch (error) {
    console.error("Error deleting listing:", error);
    throw new Error(
      `Failed to delete listing: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete a specific image from listing gallery
 */
export async function deleteListingImage(
  listingId: string,
  imageUrl: string
): Promise<boolean> {
  try {
    const existingListing = await getListingById(listingId);
    if (!existingListing) {
      throw new Error("Listing not found");
    }

    // Remove image from gallery array
    const updatedGallery =
      existingListing.gallery?.filter((url) => url !== imageUrl) || [];

    // Delete image from Cloudinary
    await deleteFile(imageUrl, "listings/gallery");

    // Update listing in database
    await db
      .update(listing)
      .set({
        gallery: updatedGallery,
        updatedAt: new Date(),
      })
      .where(eq(listing.id, listingId));

    return true;
  } catch (error) {
    console.error("Error deleting listing image:", error);
    throw new Error(
      `Failed to delete listing image: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Toggle listing active status
 */
export async function toggleListingStatus(id: string): Promise<Listing> {
  try {
    const existingListing = await getListingById(id);
    if (!existingListing) {
      throw new Error("Listing not found");
    }

    const updatedListing = await db
      .update(listing)
      .set({
        isActive: !existingListing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(listing.id, id))
      .returning();

    return updatedListing[0];
  } catch (error) {
    console.error("Error toggling listing status:", error);
    throw new Error(
      `Failed to toggle listing status: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Toggle listing featured status
 */
export async function toggleListingFeatured(id: string): Promise<Listing> {
  try {
    const existingListing = await getListingById(id);
    if (!existingListing) {
      throw new Error("Listing not found");
    }

    const updatedListing = await db
      .update(listing)
      .set({
        isFeatured: !existingListing.isFeatured,
        updatedAt: new Date(),
      })
      .where(eq(listing.id, id))
      .returning();

    return updatedListing[0];
  } catch (error) {
    console.error("Error toggling listing featured status:", error);
    throw new Error(
      `Failed to toggle listing featured status: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
