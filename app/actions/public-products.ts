"use server";

import { db } from "@/db";
import { listing, category } from "@/db/schema";
import {
  eq,
  and,
  desc,
  asc,
  like,
  gte,
  lte,
  min,
  max,
  count,
} from "drizzle-orm";

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
export async function getPublicProducts(): Promise<
  ActionResponse & { result?: PublicProduct[] }
> {
  try {
    console.log("Fetching all public products...");

    // Get all active products with category information
    const products = await db
      .select({
        id: listing.id,
        name: listing.name,
        description: listing.description,
        category: listing.category,
        categoryName: category.name,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listing.tags,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        originVillage: listing.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      })
      .from(listing)
      .leftJoin(category, eq(listing.category, category.id))
      .where(eq(listing.isActive, true))
      .orderBy(desc(listing.createdAt));

    console.log("Products fetched:", products.length);

    return {
      success: true,
      result: products,
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
  id: string
): Promise<ActionResponse & { result?: PublicProduct }> {
  try {
    const result = await db
      .select({
        id: listing.id,
        name: listing.name,
        description: listing.description,
        category: listing.category,
        categoryName: category.name,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listing.tags,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        originVillage: listing.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      })
      .from(listing)
      .leftJoin(category, eq(listing.category, category.id))
      .where(and(eq(listing.id, id), eq(listing.isActive, true)))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: "Product not found",
      };
    }

    return {
      success: true,
      result: result[0],
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
  limit: number = 4
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    // Build where conditions
    const whereConditions = [eq(listing.isActive, true)];

    if (categoryId) {
      whereConditions.push(eq(listing.category, categoryId));
    }

    const query = db
      .select({
        id: listing.id,
        name: listing.name,
        description: listing.description,
        category: listing.category,
        categoryName: category.name,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listing.tags,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        originVillage: listing.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      })
      .from(listing)
      .leftJoin(category, eq(listing.category, category.id))
      .where(and(...whereConditions))
      .orderBy(desc(listing.createdAt))
      .limit(limit + 1); // Get one extra to account for filtering

    const products = await query;

    // Filter out the current product
    const relatedProducts = products
      .filter((product) => product.id !== productId)
      .slice(0, limit);

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
  limit: number = 8
): Promise<ActionResponse & { result?: PublicProduct[] }> {
  try {
    const products = await db
      .select({
        id: listing.id,
        name: listing.name,
        description: listing.description,
        category: listing.category,
        categoryName: category.name,
        imageUrl: listing.imageUrl,
        gallery: listing.gallery,
        tags: listing.tags,
        price: listing.price,
        currency: listing.currency,
        stockQuantity: listing.stockQuantity,
        unit: listing.unit,
        isActive: listing.isActive,
        isFeatured: listing.isFeatured,
        originVillage: listing.originVillage,
        harvestDate: listing.harvestDate,
        ratingAverage: listing.ratingAverage,
        ratingCount: listing.ratingCount,
        salesCount: listing.salesCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      })
      .from(listing)
      .leftJoin(category, eq(listing.category, category.id))
      .where(and(eq(listing.isActive, true), eq(listing.isFeatured, true)))
      .orderBy(desc(listing.createdAt))
      .limit(limit);

    return {
      success: true,
      result: products,
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
