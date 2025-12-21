"use server";

import { db } from "@/db";
import { listing, listingTranslations, listingVariants, inventoryItems, inventoryLevels } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  gallery: string[] | null;
  tags: string[] | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  stockQuantity: number | null;
  unit: string | null;
  isActive: boolean | null;
  isFeatured: boolean | null;
  marketType: "local" | "international" | null;
  originVillage: string | null;
  harvestDate: Date | null;
  ratingAverage: string | null;
  ratingCount: number | null;
  salesCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  tags?: string[];
  isFeatured?: boolean;
  sortBy?: "name" | "price" | "createdAt" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

// Get all public products (no server-side filtering)
export async function getPublicProducts(
  locale: string = "en"
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    console.log("Fetching all public products...", { locale });

    // Ensure locale is valid
    const validLocale = locale || "en";

    // First, check what listings exist and their statuses (for debugging)
    const allListings = await db
      .select({
        id: listing.id,
        name: listing.name,
        status: listing.status,
      })
      .from(listing)
      .limit(10);
    
    console.log(`Total listings in database: ${allListings.length}`);
    if (allListings.length > 0) {
      const statusCounts = allListings.reduce((acc, l) => {
        acc[l.status || "null"] = (acc[l.status || "null"] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log("Status distribution:", statusCounts);
      console.log("Sample listings:", allListings.slice(0, 3).map(l => ({ id: l.id, name: l.name, status: l.status })));
    }

    // Get all active products with category information and translations
    // Note: Only show "active" status products to public
    const products = await db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.taxonomyCategoryId,
        categoryName: listing.taxonomyCategoryName,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        status: listing.status, // Select status field directly
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
          eq(listingTranslations.locale, validLocale)
        )
      )
      .where(eq(listing.status, "active"))
      .orderBy(desc(listing.createdAt));

    console.log("Active products fetched:", products.length);

    // Map products with proper type handling
    const mappedProducts = products.map((p) => ({
      id: p.id,
      name: p.name || p.nameFallback || "",
      description: p.description || p.descriptionFallback,
      category: p.category,
      categoryName: p.categoryName,
      imageUrl: p.imageUrl,
      gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0", // Ensure price is always a string
        compareAtPrice: p.compareAtPrice,
        currency: p.currency || "NPR",
        stockQuantity: null, // Stock quantity is calculated from inventory levels
      unit: p.unit || "kg",
      isActive: p.status === "active", // Compare status field
      isFeatured: p.isFeatured ?? false,
      marketType: p.marketType,
      originVillage: p.originVillage || p.originVillageFallback,
      harvestDate: p.harvestDate,
      ratingAverage: p.ratingAverage || "0",
      ratingCount: p.ratingCount ?? 0,
      salesCount: p.salesCount ?? 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    console.log("Mapped products:", mappedProducts.length);

    return {
      success: true,
      result: mappedProducts,
    };
  } catch (error) {
    console.error("Error fetching public products:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch products",
    };
  }
}

// Get a single public product by ID
export async function getPublicProductById(
  id: string,
  locale: string = "en"
): Promise<ActionResponse & { result?: PublicProduct }> {
  try {
    // Ensure locale is valid
    const validLocale = locale || "en";

    const result = await db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.taxonomyCategoryId,
        categoryName: listing.taxonomyCategoryName,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Fallback fields
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
          eq(listingTranslations.locale, validLocale)
        )
      )
      .where(and(eq(listing.id, id), eq(listing.status, "active")))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: "Product not found",
      };
    }

    const p = result[0];
    return {
      success: true,
      result: {
        id: p.id,
        name: p.name || p.nameFallback || "",
        description: p.description || p.descriptionFallback,
        category: p.category,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        currency: p.currency || "NPR",
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: p.unit || "kg",
        isActive: p.status === "active", // Compare status field
        isFeatured: p.isFeatured ?? false,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage || "0",
        ratingCount: p.ratingCount ?? 0,
        salesCount: p.salesCount ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    };
  } catch (error) {
    console.error("Error fetching public product:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product",
    };
  }
}

// Get related products (same category, excluding current product)
export async function getRelatedProducts(
  productId: string,
  categoryId: string | null,
  locale: string = "en",
  limit: number = 4
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    // Ensure locale is valid
    const validLocale = locale || "en";

    // Build where conditions
    const whereConditions = [eq(listing.status, "active")];

    if (categoryId) {
      whereConditions.push(eq(listing.taxonomyCategoryId, categoryId));
    }

    const query = db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.taxonomyCategoryId,
        categoryName: listing.taxonomyCategoryName,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Fallback fields
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
          eq(listingTranslations.locale, validLocale)
        )
      )
      .where(and(...whereConditions))
      .orderBy(desc(listing.createdAt))
      .limit(limit + 1); // Get one extra to account for filtering

    const products = await query;

    // Filter out the current product and map with fallbacks
    const relatedProducts = products
      .filter((product) => product.id !== productId)
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        name: p.name || p.nameFallback || "",
        description: p.description || p.descriptionFallback,
        category: p.category,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0",
        compareAtPrice: p.compareAtPrice,
        currency: p.currency || "NPR",
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: p.unit || "kg",
        isActive: p.status === "active", // Compare status field
        isFeatured: p.isFeatured ?? false,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage || "0",
        ratingCount: p.ratingCount ?? 0,
        salesCount: p.salesCount ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

    return {
      success: true,
      result: relatedProducts,
    };
  } catch (error) {
    console.error("Error fetching related products:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch related products",
    };
  }
}

// Get featured products
export async function getFeaturedProducts(
  locale: string = "en",
  limit: number = 8
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    // Ensure locale is valid
    const validLocale = locale || "en";

    const products = await db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        description: listingTranslations.description,
        category: listing.taxonomyCategoryId,
        categoryName: listing.taxonomyCategoryName,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listingTranslations.tags,
        price: listing.price,
        compareAtPrice: listing.compareAtPrice,
        currency: listing.currency,
        unit: listing.unit,
        status: listing.status, // Select status field directly
        isFeatured: listing.isFeatured,
        marketType: listing.marketType,
        originVillage: listingTranslations.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Fallback fields
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
          eq(listingTranslations.locale, validLocale)
        )
      )
      .where(and(eq(listing.status, "active"), eq(listing.isFeatured, true)))
      .orderBy(desc(listing.createdAt))
      .limit(limit);

    return {
      success: true,
      result: products.map((p) => ({
        id: p.id,
        name: p.name || p.nameFallback || "",
        description: p.description || p.descriptionFallback,
        category: p.category,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        gallery: p.gallery,
        tags: p.tags || p.tagsFallback,
        price: p.price || "0",
        currency: p.currency || "NPR",
        stockQuantity: p.stockQuantity,
        unit: p.unit || "kg",
        isActive: p.status === "active", // Compare status field
        isFeatured: p.isFeatured ?? false,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage || "0",
        ratingCount: p.ratingCount ?? 0,
        salesCount: p.salesCount ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Error fetching featured products:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch featured products",
    };
  }
}

// Get variants for a public product
export async function getPublicProductVariants(
  listingId: string
): Promise<ActionResponse & { result?: Array<{
  id: string;
  title: string;
  sku: string | null;
  price: string | null;
  currency: string | null;
  compareAtPrice: string | null;
  imageUrl: string | null;
  options: Record<string, string> | null;
  available: number | null;
}> }> {
  try {
    const variants = await db
      .select({
        id: listingVariants.id,
        title: listingVariants.title,
        sku: listingVariants.sku,
        price: listingVariants.price,
        currency: listingVariants.currency,
        compareAtPrice: listingVariants.compareAtPrice,
        imageUrl: listingVariants.imageUrl,
        options: listingVariants.options,
        available: inventoryLevels.available,
      })
      .from(listingVariants)
      .leftJoin(
        inventoryItems,
        eq(inventoryItems.variantId, listingVariants.id)
      )
      .leftJoin(
        inventoryLevels,
        eq(inventoryLevels.inventoryItemId, inventoryItems.id)
      )
      .where(eq(listingVariants.listingId, listingId))
      .orderBy(listingVariants.createdAt);

    return {
      success: true,
      result: variants.map((v) => ({
        id: v.id,
        title: v.title,
        sku: v.sku,
        price: v.price,
        currency: v.currency,
        compareAtPrice: v.compareAtPrice,
        imageUrl: v.imageUrl,
        options: (v.options as Record<string, string> | null) || null,
        available: v.available,
      })),
    };
  } catch (error) {
    console.error("Error fetching public product variants:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch variants",
    };
  }
}
