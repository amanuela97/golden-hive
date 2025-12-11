import { db } from "@/db";
import {
  listing,
  listingTranslations,
  user,
  vendor,
  listingVariants,
  inventoryItems,
  inventoryLevels,
  type Listing,
} from "@/db/schema";

// Re-export the Listing type for use in components
export type { Listing };
import { uploadFile, uploadFiles, deleteFile, deleteFiles } from "./cloudinary";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { translateText } from "./translate";
import { findCategoryById } from "./taxonomy";

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

// Variant data structure
export type VariantData = {
  id?: string; // Optional for new variants
  title: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  imageUrl?: string;
  options?: Record<string, string>; // e.g., { size: "500g", color: "red" }
  // Inventory fields
  initialStock?: number;
  costPerItem?: number;
};

// Types for CRUD operations
export type CreateListingData = {
  name: string;
  description?: string;
  categoryRuleId?: string; // Optional - reference to category_rules table (only if category has rules)
  taxonomyCategoryId: string; // Required - Taxonomy category ID from JSON file
  taxonomyCategoryName?: string; // Short name (e.g., "Honey") - will be extracted if not provided
  price: number; // Default price (used if no variants)
  compareAtPrice?: number; // Optional compare-at price
  currency?: string;
  unit?: string;
  producerId: string;
  imageUrl?: string;
  gallery?: string[];
  tags?: string[];
  status?: "active" | "draft" | "archived"; // Shopify-style status
  isFeatured?: boolean;
  marketType?: "local" | "international";
  originVillage?: string;
  harvestDate?: Date;
  // Variants (relational, not JSON)
  variants?: VariantData[];
  // Inventory settings
  tracksInventory?: boolean;
  inventoryLocationId?: string; // Required if tracksInventory is true
  // Media files for upload
  mainImage?: File | Blob;
  galleryFiles?: (File | Blob)[];
  variantImages?: Record<string, File[]>; // Variant images keyed by variant ID
};

export type UpdateListingData = Partial<
  Omit<CreateListingData, "producerId">
> & {
  id: string;
};

/**
 * Create a new listing (Shopify-style workflow)
 * Step 1: Insert listing
 * Step 2: Create variants (or default variant if none)
 * Step 3: Create inventory items for each variant
 * Step 4: Create inventory levels for each variant and location
 */
export async function createListing(data: CreateListingData): Promise<Listing> {
  try {
    // Validate required fields
    if (!data.name || !data.price || !data.producerId || !data.taxonomyCategoryId) {
      throw new Error("Name, price, producerId, and taxonomyCategoryId are required");
    }

    // Validate variants: max 100 variants, max 3 options
    if (data.variants && data.variants.length > 100) {
      throw new Error("Maximum 100 variants allowed per product");
    }

    // Check options count across all variants
    if (data.variants) {
      const allOptionKeys = new Set<string>();
      for (const variant of data.variants) {
        if (variant.options) {
          Object.keys(variant.options).forEach((key) => allOptionKeys.add(key));
        }
      }
      if (allOptionKeys.size > 3) {
        throw new Error("Maximum 3 option types allowed per product (e.g., size, color, weight)");
      }
    }

    // Validate inventory location if tracking inventory
    if (data.tracksInventory && !data.inventoryLocationId) {
      throw new Error("Inventory location is required when tracking inventory");
    }

    // Fetch vendor from vendor table
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, data.producerId))
      .limit(1);

    if (vendorResult.length === 0) {
      throw new Error("Vendor not found. Please set up your vendor information in Settings > Vendor before creating a listing.");
    }

    const vendorId = vendorResult[0].id;

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

    // Step 1: Create listing in database
    const listingId = uuidv4();
    const publishedAt = data.status === "active" ? new Date() : null;
    
    const newListing = await db
      .insert(listing)
      .values({
        id: listingId,
        name: data.name,
        description: data.description,
        vendorId: vendorId,
        categoryRuleId: data.categoryRuleId || null,
        taxonomyCategoryId: data.taxonomyCategoryId,
        price: data.price.toString(),
        compareAtPrice: data.compareAtPrice ? data.compareAtPrice.toString() : null,
        currency: data.currency || "NPR",
        unit: data.unit || "kg",
        producerId: data.producerId,
        imageUrl,
        gallery,
        tags: data.tags || [],
        status: data.status || "draft",
        isFeatured: data.isFeatured ?? false,
        marketType: data.marketType || "local",
        publishedAt,
        originVillage: data.originVillage,
        harvestDate: data.harvestDate,
      })
      .returning();

    // Step 2: Create variants (Shopify always creates at least one variant)
    const variantsToCreate = data.variants && data.variants.length > 0
      ? data.variants
      : [
          {
            title: "Default",
            price: data.price,
            compareAtPrice: data.compareAtPrice,
            sku: undefined,
            imageUrl: undefined,
            options: undefined,
            initialStock: data.tracksInventory ? 0 : undefined,
            costPerItem: undefined,
          } as VariantData,
        ];

    const createdVariants = [];

    for (const variantData of variantsToCreate) {
      // Upload variant image if provided
      let variantImageUrl = variantData.imageUrl;
      if (variantData.id && data.variantImages?.[variantData.id]) {
        const variantImageFiles = data.variantImages[variantData.id];
        if (variantImageFiles && variantImageFiles.length > 0) {
          const variantImageUrls = await uploadFiles(
            variantImageFiles,
            `listings/variants/${listingId}/${variantData.id}`
          );
          variantImageUrl = variantImageUrls[0] || variantImageUrl;
        }
      }

      const variant = await db
        .insert(listingVariants)
        .values({
          listingId,
          title: variantData.title,
          sku: variantData.sku || null,
          price: variantData.price ? variantData.price.toString() : null,
          compareAtPrice: variantData.compareAtPrice
            ? variantData.compareAtPrice.toString()
            : null,
          imageUrl: variantImageUrl || null,
          options: variantData.options || null,
        })
        .returning();

      createdVariants.push({ ...variant[0], initialStock: variantData.initialStock, costPerItem: variantData.costPerItem });
    }

    // Step 3 & 4: Create inventory items and levels (if tracking inventory)
    if (data.tracksInventory && data.inventoryLocationId) {
      for (const variant of createdVariants) {
        // Step 3: Create inventory item for each variant
        const inventoryItem = await db
          .insert(inventoryItems)
          .values({
            variantId: variant.id,
            costPerItem: variant.costPerItem
              ? variant.costPerItem.toString()
              : "0",
            requiresShipping: true,
            weightGrams: 0,
          })
          .returning();

        // Step 4: Create inventory level for this variant and location
        await db.insert(inventoryLevels).values({
          inventoryItemId: inventoryItem[0].id,
          locationId: data.inventoryLocationId,
          available: variant.initialStock || 0,
          committed: 0,
          incoming: 0,
        });
      }
    }

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
    // Validate ID format (should be a UUID or valid ID, not a route segment)
    if (!id || id.trim() === "" || id === "products" || id === "new") {
      return null;
    }
    
    // Fetch listing with English translations (admin/seller dashboard uses English)
    const result = await db
      .select({
        id: listing.id,
        producerId: listing.producerId,
        name: listingTranslations.name,
        description: listingTranslations.description,
        vendorId: listing.vendorId,
        categoryRuleId: listing.categoryRuleId,
        taxonomyCategoryId: listing.taxonomyCategoryId,
        taxonomyCategoryName: listing.taxonomyCategoryName,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        status: listing.status,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        publishedAt: listing.publishedAt,
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
      vendorId: r.vendorId || null,
      categoryRuleId: r.categoryRuleId,
      taxonomyCategoryId: r.taxonomyCategoryId || null,
      taxonomyCategoryName: r.taxonomyCategoryName || null,
      price: r.price,
      compareAtPrice: r.compareAtPrice || null,
      currency: r.currency,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      status: r.status || "draft",
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      publishedAt: r.publishedAt || null,
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
        vendorId: listing.vendorId,
        categoryRuleId: listing.categoryRuleId,
        taxonomyCategoryId: listing.taxonomyCategoryId,
        taxonomyCategoryName: listing.taxonomyCategoryName,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        status: listing.status,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        publishedAt: listing.publishedAt,
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
      vendorId: r.vendorId || null,
      categoryRuleId: r.categoryRuleId,
      taxonomyCategoryId: r.taxonomyCategoryId || null,
      taxonomyCategoryName: r.taxonomyCategoryName || null,
      price: r.price,
      compareAtPrice: r.compareAtPrice || null,
      currency: r.currency,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      status: r.status || "draft",
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      publishedAt: r.publishedAt || null,
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
        vendorId: listing.vendorId,
        categoryRuleId: listing.categoryRuleId,
        taxonomyCategoryId: listing.taxonomyCategoryId,
        taxonomyCategoryName: listing.taxonomyCategoryName,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        producerId: listing.producerId,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        status: listing.status,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        publishedAt: listing.publishedAt,
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

    return result.map((r) => {
      // Ensure gallery is an array
      let gallery: string[] = [];
      if (Array.isArray(r.gallery)) {
        gallery = r.gallery;
      } else if (r.gallery) {
        gallery = [r.gallery as unknown as string];
      }

      // Ensure tags is an array
      let tags: string[] = [];
      if (Array.isArray(r.tags)) {
        tags = r.tags;
      } else if (r.tags) {
        tags = [r.tags as unknown as string];
      }
      
      const tagsFallback: string[] = Array.isArray(r.tagsFallback) 
        ? r.tagsFallback 
        : r.tagsFallback 
          ? [r.tagsFallback as unknown as string] 
          : [];

      return {
        id: r.id,
        producerId: r.producerId,
        name: r.name || r.nameFallback || "",
        description: r.description || r.descriptionFallback || null,
        vendorId: r.vendorId || null,
        categoryRuleId: r.categoryRuleId,
        taxonomyCategoryId: r.taxonomyCategoryId || null,
        price: r.price,
        compareAtPrice: r.compareAtPrice || null,
        currency: r.currency || "NPR",
        unit: r.unit || "kg",
        imageUrl: r.imageUrl || null,
        gallery,
        tags: tags.length > 0 ? tags : tagsFallback,
        status: r.status || "draft",
        isFeatured: r.isFeatured ?? false,
        marketType: r.marketType || "local",
        publishedAt: r.publishedAt || null,
        originVillage: r.originVillage || r.originVillageFallback || null,
        harvestDate: r.harvestDate || null,
        ratingAverage: r.ratingAverage || "0",
        ratingCount: r.ratingCount || 0,
        salesCount: r.salesCount || 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        producerName: r.producerName || "",
        producerEmail: r.producerEmail || "",
        isAdminCreated: adminEmails.includes(r.producerEmail || ""),
      };
    });
  } catch (error) {
    console.error("Error fetching listings with users:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if the error is specifically about missing category_rule_id column (PostgreSQL error code 42703)
    const pgError = error as any;
    if (
      (pgError?.code === "42703" && errorMessage.includes("category_rule_id")) ||
      (errorMessage.includes("category_rule_id") && errorMessage.includes("does not exist"))
    ) {
      throw new Error(
        `Database schema is out of sync. The 'category_rule_id' column is missing from the 'listing' table. ` +
        `Please run: npx tsx scripts/add-category-rule-id-column.ts to add this column.`
      );
    }
    
    throw new Error(
      `Failed to fetch listings with users: ${errorMessage}`
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
        vendorId: listing.vendorId,
        categoryRuleId: listing.categoryRuleId,
        taxonomyCategoryId: listing.taxonomyCategoryId,
        taxonomyCategoryName: listing.taxonomyCategoryName,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        status: listing.status,
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        publishedAt: listing.publishedAt,
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
      vendorId: r.vendorId || null,
      categoryRuleId: r.categoryRuleId,
      taxonomyCategoryId: r.taxonomyCategoryId || null,
      taxonomyCategoryName: r.taxonomyCategoryName || null,
      price: r.price,
      compareAtPrice: r.compareAtPrice || null,
      currency: r.currency,
      unit: r.unit,
      imageUrl: r.imageUrl,
      gallery: r.gallery,
      tags: r.tags || r.tagsFallback || [],
      status: r.status || "draft",
      isFeatured: r.isFeatured,
      marketType: r.marketType,
      publishedAt: r.publishedAt || null,
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


    // Extract taxonomy category short name if category is being updated
    let taxonomyCategoryName: string | null = null;
    if (updateData.taxonomyCategoryId) {
      const category = findCategoryById(updateData.taxonomyCategoryId);
      if (category) {
        taxonomyCategoryName = category.name; // Short name (e.g., "Honey")
      }
    } else if (existingListing.taxonomyCategoryId) {
      // Keep existing short name if category is not being updated
      const existingListingWithName = await db
        .select({ taxonomyCategoryName: listing.taxonomyCategoryName })
        .from(listing)
        .where(eq(listing.id, id))
        .limit(1);
      taxonomyCategoryName = existingListingWithName[0]?.taxonomyCategoryName || null;
    }

    // Determine publishedAt based on status
    const publishedAt = updateData.status === "active" && !existingListing.publishedAt
      ? new Date()
      : updateData.status === "active"
      ? existingListing.publishedAt
      : updateData.status === "draft" || updateData.status === "archived"
      ? null
      : existingListing.publishedAt;

    // Update base listing table (non-translatable fields)
    const baseUpdateData: Partial<typeof listing.$inferInsert> = {
      categoryRuleId: updateData.categoryRuleId !== undefined ? updateData.categoryRuleId : existingListing.categoryRuleId || null,
      taxonomyCategoryId: updateData.taxonomyCategoryId || existingListing.taxonomyCategoryId || null, // Taxonomy category ID
      taxonomyCategoryName: taxonomyCategoryName !== null ? taxonomyCategoryName : undefined, // Short name
      imageUrl: imageUrl || undefined,
      gallery,
      updatedAt: new Date(),
      price: updateData.price ? String(updateData.price) : undefined,
      compareAtPrice: updateData.compareAtPrice ? String(updateData.compareAtPrice) : undefined,
      currency: updateData.currency,
      unit: updateData.unit,
      status: updateData.status || existingListing.status || "draft",
      isFeatured: updateData.isFeatured,
      marketType: updateData.marketType,
      publishedAt,
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
 * Toggle listing status between active and draft
 */
export async function toggleListingStatus(id: string): Promise<Listing> {
  try {
    const existingListing = await getListingById(id);
    if (!existingListing) {
      throw new Error("Listing not found");
    }

    // Toggle between active and draft
    const newStatus = existingListing.status === "active" ? "draft" : "active";
    const publishedAt = newStatus === "active" && !existingListing.publishedAt
      ? new Date()
      : existingListing.publishedAt;

    const updatedListing = await db
      .update(listing)
      .set({
        status: newStatus,
        publishedAt,
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
