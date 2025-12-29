"use server";

import { db } from "@/db";
import { listing, listingTranslations, store } from "@/db/schema";
import { eq, and, or, ilike, sql, desc, isNotNull } from "drizzle-orm";

export interface SearchResult {
  type: "product" | "store" | "category";
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string | null;
  description?: string | null;
  price?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
  categoryName?: string | null;
}

/**
 * Search across products, stores, and categories
 */
export async function searchAll(
  query: string,
  locale: string = "en"
): Promise<{
  success: boolean;
  results: SearchResult[];
  error?: string;
}> {
  try {
    if (!query || query.trim().length === 0) {
      return { success: true, results: [] };
    }

    const searchTerm = `%${query.trim()}%`;

    // Search products (listings)
    const products = await db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        nameFallback: listing.name,
        description: listingTranslations.description,
        descriptionFallback: listing.description,
        imageUrl: listing.imageUrl,
        price: listing.price,
        storeName: store.storeName,
        storeSlug: store.slug,
        categoryName: listing.taxonomyCategoryName,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, locale)
        )
      )
      .leftJoin(store, eq(store.id, listing.storeId))
      .where(
        and(
          eq(listing.status, "active"),
          or(
            ilike(listing.name, searchTerm),
            ilike(listingTranslations.name, searchTerm),
            ilike(listing.description, searchTerm),
            ilike(listingTranslations.description, searchTerm),
            ilike(store.storeName, searchTerm),
            ilike(listing.taxonomyCategoryName, searchTerm)
          )
        )
      )
      .limit(20);

    // Search stores
    const stores = await db
      .select({
        id: store.id,
        storeName: store.storeName,
        logoUrl: store.logoUrl,
        slug: store.slug,
      })
      .from(store)
      .where(
        and(eq(store.visibility, "public"), ilike(store.storeName, searchTerm))
      )
      .limit(10);

    // Search categories (from listing taxonomyCategoryName)
    // Get unique categories by fetching all matching listings and deduplicating
    const categoryResults = await db
      .select({
        id: listing.taxonomyCategoryId,
        name: listing.taxonomyCategoryName,
      })
      .from(listing)
      .where(
        and(
          eq(listing.status, "active"),
          isNotNull(listing.taxonomyCategoryId),
          isNotNull(listing.taxonomyCategoryName),
          ilike(listing.taxonomyCategoryName, searchTerm)
        )
      )
      .limit(50); // Get more to ensure we have enough unique categories

    // Deduplicate categories
    const categoryMap = new Map<string, string>();
    categoryResults.forEach((c) => {
      if (c.id && c.name && !categoryMap.has(c.id)) {
        categoryMap.set(c.id, c.name);
      }
    });

    const categories = Array.from(categoryMap.entries())
      .slice(0, 10)
      .map(([id, name]) => ({ id, name }));

    // Format results
    const results: SearchResult[] = [
      ...products.map((p) => ({
        type: "product" as const,
        id: p.id,
        name: p.name || p.nameFallback || "",
        imageUrl: p.imageUrl,
        description: p.description || p.descriptionFallback || null,
        price: p.price,
        storeName: p.storeName || null,
        storeSlug: p.storeSlug || null,
        categoryName: p.categoryName || null,
      })),
      ...stores.map((s) => ({
        type: "store" as const,
        id: s.id,
        name: s.storeName,
        slug: s.slug,
        imageUrl: s.logoUrl,
      })),
      ...categories.map((c) => ({
        type: "category" as const,
        id: c.id,
        name: c.name,
      })),
    ];

    return { success: true, results };
  } catch (error) {
    console.error("Search error:", error);
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

/**
 * Search products only (for product listing page)
 */
export async function searchProducts(
  query: string,
  locale: string = "en",
  options?: {
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    categoryId?: string;
    storeId?: string;
  }
): Promise<{
  success: boolean;
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
}> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        success: true,
        results: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }

    const searchTerm = `%${query.trim()}%`;
    const page = options?.page || 1;
    const limit = options?.limit || 24;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [
      eq(listing.status, "active"),
      or(
        ilike(listing.name, searchTerm),
        ilike(listingTranslations.name, searchTerm),
        ilike(listing.description, searchTerm),
        ilike(listingTranslations.description, searchTerm),
        ilike(store.storeName, searchTerm),
        ilike(listing.taxonomyCategoryName, searchTerm)
      ),
    ];

    if (options?.minPrice) {
      whereConditions.push(sql`${listing.price} >= ${options.minPrice}`);
    }
    if (options?.maxPrice) {
      whereConditions.push(sql`${listing.price} <= ${options.maxPrice}`);
    }
    if (options?.categoryId) {
      whereConditions.push(eq(listing.taxonomyCategoryId, options.categoryId));
    }
    if (options?.storeId) {
      whereConditions.push(eq(listing.storeId, options.storeId));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, locale)
        )
      )
      .leftJoin(store, eq(store.id, listing.storeId))
      .where(and(...whereConditions));

    const total = Number(countResult[0]?.count || 0);

    // Get products
    const products = await db
      .select({
        id: listing.id,
        name: listingTranslations.name,
        nameFallback: listing.name,
        description: listingTranslations.description,
        descriptionFallback: listing.description,
        imageUrl: listing.imageUrl,
        price: listing.price,
        storeName: store.storeName,
        storeSlug: store.slug,
        categoryName: listing.taxonomyCategoryName,
      })
      .from(listing)
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, locale)
        )
      )
      .leftJoin(store, eq(store.id, listing.storeId))
      .where(and(...whereConditions))
      .orderBy(desc(listing.createdAt))
      .limit(limit)
      .offset(offset);

    const results: SearchResult[] = products.map((p) => ({
      type: "product" as const,
      id: p.id,
      name: p.name || p.nameFallback || "",
      imageUrl: p.imageUrl,
      description: p.description || p.descriptionFallback || null,
      price: p.price,
      storeName: p.storeName || null,
      storeSlug: p.storeSlug || null,
      categoryName: p.categoryName || null,
    }));

    return {
      success: true,
      results,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error("Product search error:", error);
    return {
      success: false,
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}
