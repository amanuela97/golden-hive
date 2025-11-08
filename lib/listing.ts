import { db } from "@/db";
import { listing, listingTranslations, user, type Listing } from "@/db/schema";

// Re-export the Listing type for use in components
export type { Listing };
import { uploadFile, uploadFiles, deleteFile, deleteFiles } from "./cloudinary";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { translateText } from "./translate";

// Helper function to translate text to all locales
async function translateToAllLocales(
  text: string | null | undefined
): Promise<Record<string, string | null>> {
  if (!text) {
    return { en: null, fi: null, ne: null };
  }

  const translations: Record<string, string | null> = {
    en: text, // English is the source
  };

  try {
    translations.fi = await translateText(text, "fi");
  } catch (error) {
    console.error("Error translating to Finnish:", error);
    translations.fi = text; // Fallback to English
  }

  try {
    translations.ne = await translateText(text, "ne");
  } catch (error) {
    console.error("Error translating to Nepali:", error);
    translations.ne = text; // Fallback to English
  }

  return translations;
}

// Helper function to translate tags array
async function translateTags(
  tags: string[] | null | undefined
): Promise<Record<string, string[] | null>> {
  if (!tags || tags.length === 0) {
    return { en: null, fi: null, ne: null };
  }

  const translations: Record<string, string[] | null> = {
    en: tags, // English is the source
  };

  try {
    const fiTags = await Promise.all(
      tags.map(async (tag) => await translateText(tag, "fi"))
    );
    translations.fi = fiTags;
  } catch (error) {
    console.error("Error translating tags to Finnish:", error);
    translations.fi = tags; // Fallback to English
  }

  try {
    const neTags = await Promise.all(
      tags.map(async (tag) => await translateText(tag, "ne"))
    );
    translations.ne = neTags;
  } catch (error) {
    console.error("Error translating tags to Nepali:", error);
    translations.ne = tags; // Fallback to English
  }

  return translations;
}

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
  marketType?: "local" | "international";
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

    // Create listing in database (non-translatable fields only)
    const listingId = uuidv4();
    const newListing = await db
      .insert(listing)
      .values({
        id: listingId,
        name: data.name, // Keep in base table for fallback
        description: data.description, // Keep in base table for fallback
        category: data.category || null, // Convert empty string to null for UUID field
        price: data.price.toString(),
        currency: data.currency || "NPR",
        stockQuantity: data.stockQuantity || 0,
        unit: data.unit || "kg",
        producerId: data.producerId,
        imageUrl,
        gallery,
        tags: data.tags || [], // Keep in base table for fallback
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
        marketType: data.marketType || "local",
        originVillage: data.originVillage, // Keep in base table for fallback
        harvestDate: data.harvestDate,
      })
      .returning();

    // Translate and insert translations for all locales
    const [
      nameTranslations,
      descriptionTranslations,
      tagsTranslations,
      originVillageTranslations,
    ] = await Promise.all([
      translateToAllLocales(data.name),
      translateToAllLocales(data.description),
      translateTags(data.tags),
      translateToAllLocales(data.originVillage),
    ]);

    // Insert translations for all locales
    const locales = ["en", "fi", "ne"];
    for (const loc of locales) {
      await db.insert(listingTranslations).values({
        listingId,
        locale: loc,
        name: nameTranslations[loc],
        description: descriptionTranslations[loc],
        tags: tagsTranslations[loc],
        originVillage: originVillageTranslations[loc],
      });
    }

    return newListing[0];
  } catch (error) {
    console.error("Error creating listing:", error);
    throw new Error(
      `Failed to create listing: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get a single listing by ID (admin/seller dashboard - uses English translations)
 */
export async function getListingById(id: string): Promise<Listing | null> {
  try {
    // Fetch listing with English translations (admin/seller dashboard uses English)
    const result = await db
      .select({
        id: listing.id,
        producerId: listing.producerId,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.category,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Fallback fields from base table
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, "en")
        )
      )
      .where(eq(listing.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const r = result[0];
    return {
      id: r.id,
      producerId: r.producerId,
      name: r.name || r.nameFallback || "",
      description: r.description || r.descriptionFallback || null,
      category: r.category,
      price: r.price,
      currency: r.currency,
      stockQuantity: r.stockQuantity,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      isActive: r.isActive,
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      originVillage: r.originVillage || r.originVillageFallback || null,
      harvestDate: r.harvestDate,
      ratingAverage: r.ratingAverage,
      ratingCount: r.ratingCount,
      salesCount: r.salesCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    } as Listing;
  } catch (error) {
    console.error("Error fetching listing:", error);
    throw new Error(
      `Failed to fetch listing: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get all listings (admin dashboard - uses English translations)
 */
export async function getListings(): Promise<Listing[]> {
  try {
    // Fetch listings with English translations (admin dashboard uses English)
    const result = await db
      .select({
        id: listing.id,
        producerId: listing.producerId,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.category,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Fallback fields from base table
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, "en")
        )
      )
      .orderBy(listing.createdAt);

    return result.map((r) => ({
      id: r.id,
      producerId: r.producerId,
      name: r.name || r.nameFallback || "",
      description: r.description || r.descriptionFallback || null,
      category: r.category,
      price: r.price,
      currency: r.currency,
      stockQuantity: r.stockQuantity,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      isActive: r.isActive,
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      originVillage: r.originVillage || r.originVillageFallback || null,
      harvestDate: r.harvestDate,
      ratingAverage: r.ratingAverage,
      ratingCount: r.ratingCount,
      salesCount: r.salesCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })) as Listing[];
  } catch (error) {
    console.error("Error fetching listings:", error);
    throw new Error(
      `Failed to fetch listings: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get all listings with user information for admin management (uses English translations)
 */
export async function getAllListingsWithUsers(): Promise<
  Array<
    Listing & {
      producerName: string;
      producerEmail: string;
      isAdminCreated: boolean;
    }
  >
> {
  try {
    // Fetch listings with English translations and user info (admin dashboard uses English)
    const result = await db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.category,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        producerId: listing.producerId,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        producerName: user.name,
        producerEmail: user.email,
        // Fallback fields from base table
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .innerJoin(user, eq(listing.producerId, user.id))
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, "en")
        )
      )
      .orderBy(listing.createdAt);

    // Check if producer is admin
    const adminEmails = process.env.ADMIN_LIST?.split(",") || [];

    return result.map((r) => ({
      id: r.id,
      producerId: r.producerId,
      name: r.name || r.nameFallback || "",
      description: r.description || r.descriptionFallback || null,
      category: r.category,
      price: r.price,
      currency: r.currency,
      stockQuantity: r.stockQuantity,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      isActive: r.isActive,
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      originVillage: r.originVillage || r.originVillageFallback || null,
      harvestDate: r.harvestDate,
      ratingAverage: r.ratingAverage,
      ratingCount: r.ratingCount,
      salesCount: r.salesCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      producerName: r.producerName,
      producerEmail: r.producerEmail,
      isAdminCreated: adminEmails.includes(r.producerEmail),
    }));
  } catch (error) {
    console.error("Error fetching listings with users:", error);
    throw new Error(
      `Failed to fetch listings with users: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get listings by producer ID (seller dashboard - uses English translations)
 */
export async function getListingsByProducer(
  producerId: string
): Promise<Listing[]> {
  try {
    // Fetch listings with English translations (seller dashboard uses English)
    const result = await db
      .select({
        id: listing.id,
        producerId: listing.producerId,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.category,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Fallback fields from base table
        nameFallback: listing.name,
        descriptionFallback: listing.description,
        tagsFallback: listing.tags,
        originVillageFallback: listing.originVillage,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, "en")
        )
      )
      .where(eq(listing.producerId, producerId))
      .orderBy(listing.createdAt);

    return result.map((r) => ({
      id: r.id,
      producerId: r.producerId,
      name: r.name || r.nameFallback || "",
      description: r.description || r.descriptionFallback || null,
      category: r.category,
      price: r.price,
      currency: r.currency,
      stockQuantity: r.stockQuantity,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      isActive: r.isActive,
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      originVillage: r.originVillage || r.originVillageFallback || null,
      harvestDate: r.harvestDate,
      ratingAverage: r.ratingAverage,
      ratingCount: r.ratingCount,
      salesCount: r.salesCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })) as Listing[];
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

    // Update base listing table (non-translatable fields)
    const baseUpdateData: Partial<typeof listing.$inferInsert> = {
      category: updateData.category || null,
      imageUrl: imageUrl || undefined,
      gallery,
      updatedAt: new Date(),
      price: updateData.price ? String(updateData.price) : undefined,
      currency: updateData.currency,
      stockQuantity: updateData.stockQuantity,
      unit: updateData.unit,
      isActive: updateData.isActive,
      isFeatured: updateData.isFeatured,
      marketType: updateData.marketType,
      harvestDate: updateData.harvestDate,
    };

    // Also update base table fields for fallback (if provided)
    if (updateData.name !== undefined) baseUpdateData.name = updateData.name;
    if (updateData.description !== undefined)
      baseUpdateData.description = updateData.description;
    if (updateData.tags !== undefined) baseUpdateData.tags = updateData.tags;
    if (updateData.originVillage !== undefined)
      baseUpdateData.originVillage = updateData.originVillage;

    const updatedListing = await db
      .update(listing)
      .set(baseUpdateData)
      .where(eq(listing.id, id))
      .returning();

    // Translate and update/insert translations for all locales
    if (
      updateData.name !== undefined ||
      updateData.description !== undefined ||
      updateData.tags !== undefined ||
      updateData.originVillage !== undefined
    ) {
      const [
        nameTranslations,
        descriptionTranslations,
        tagsTranslations,
        originVillageTranslations,
      ] = await Promise.all([
        updateData.name !== undefined
          ? translateToAllLocales(updateData.name)
          : Promise.resolve({ en: null, fi: null, ne: null }),
        updateData.description !== undefined
          ? translateToAllLocales(updateData.description)
          : Promise.resolve({ en: null, fi: null, ne: null }),
        updateData.tags !== undefined
          ? translateTags(updateData.tags)
          : Promise.resolve({ en: null, fi: null, ne: null }),
        updateData.originVillage !== undefined
          ? translateToAllLocales(updateData.originVillage)
          : Promise.resolve({ en: null, fi: null, ne: null }),
      ]);

      // Get existing translations
      const existingTranslations = await db
        .select()
        .from(listingTranslations)
        .where(eq(listingTranslations.listingId, id));

      const existingByLocale = new Map(
        existingTranslations.map((t) => [t.locale, t])
      );

      // Update or insert for all locales
      const locales = ["en", "fi", "ne"];
      for (const loc of locales) {
        const existing = existingByLocale.get(loc);
        const translationData: {
          listingId: string;
          locale: string;
          name?: string | null;
          description?: string | null;
          tags?: string[] | null;
          originVillage?: string | null;
        } = {
          listingId: id,
          locale: loc,
        };

        // Use new translations if provided, otherwise keep existing values
        if (updateData.name !== undefined) {
          translationData.name = (
            nameTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.name = existing.name;
        }

        if (updateData.description !== undefined) {
          translationData.description = (
            descriptionTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.description = existing.description;
        }

        if (updateData.tags !== undefined) {
          translationData.tags = (
            tagsTranslations as Record<string, string[] | null>
          )[loc];
        } else if (existing) {
          translationData.tags = existing.tags;
        }

        if (updateData.originVillage !== undefined) {
          translationData.originVillage = (
            originVillageTranslations as Record<string, string | null>
          )[loc];
        } else if (existing) {
          translationData.originVillage = existing.originVillage;
        }

        if (existing) {
          await db
            .update(listingTranslations)
            .set(translationData)
            .where(eq(listingTranslations.id, existing.id));
        } else {
          await db.insert(listingTranslations).values(translationData);
        }
      }
    }

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
