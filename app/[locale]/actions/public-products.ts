"use server";

import { db } from "@/db";
import { listing, listingTranslations } from "@/db/schema";
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
    console.log("Fetching all public products...");

    // Get all active products with category information and translations
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
        currency: listing.currency,
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: listing.unit,
        isActive: listing.status === "active",
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
          eq(listingTranslations.locale, locale)
        )
      )
      .where(eq(listing.status, "active"))
      .orderBy(desc(listing.createdAt));

    console.log("Products fetched:", products.length);

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
        price: p.price,
        currency: p.currency,
        stockQuantity: p.stockQuantity,
        unit: p.unit,
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        salesCount: p.salesCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
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
        currency: listing.currency,
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: listing.unit,
        isActive: listing.status === "active",
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
          eq(listingTranslations.locale, locale)
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
        price: p.price,
        currency: p.currency,
        stockQuantity: p.stockQuantity,
        unit: p.unit,
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        salesCount: p.salesCount,
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
        currency: listing.currency,
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: listing.unit,
        isActive: listing.status === "active",
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
          eq(listingTranslations.locale, locale)
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
        price: p.price,
        currency: p.currency,
        stockQuantity: p.stockQuantity,
        unit: p.unit,
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        salesCount: p.salesCount,
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
        currency: listing.currency,
        stockQuantity: null, // Stock quantity is calculated from inventory levels
        unit: listing.unit,
        isActive: listing.status === "active",
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
          eq(listingTranslations.locale, locale)
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
        price: p.price,
        currency: p.currency,
        stockQuantity: p.stockQuantity,
        unit: p.unit,
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        marketType: p.marketType,
        originVillage: p.originVillage || p.originVillageFallback,
        harvestDate: p.harvestDate,
        ratingAverage: p.ratingAverage,
        ratingCount: p.ratingCount,
        salesCount: p.salesCount,
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
