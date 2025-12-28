"use server";

import { db } from "@/db";
import {
  listing,
  store,
  listingTranslations,
  storeBannerImage,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getTrendingProducts } from "./trending";
import { PublicProduct } from "./public-products";

export async function getNewArrivals(options?: {
  limit?: number;
  locale?: string;
}): Promise<PublicProduct[]> {
  const limit = options?.limit || 6;
  const locale = options?.locale || "en";

  const products = await db
    .select({
      id: listing.id,
      slug: listing.slug,
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
      status: listing.status,
      isFeatured: listing.isFeatured,
      marketType: listing.marketType,
      originVillage: listingTranslations.originVillage,
      harvestDate: listing.harvestDate,
      ratingAverage: listing.ratingAverage,
      ratingCount: listing.ratingCount,
      salesCount: listing.salesCount,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      storeName: store.storeName,
      storeSlug: store.slug,
      nameFallback: listing.name,
      descriptionFallback: listing.description,
      tagsFallback: listing.tags,
      originVillageFallback: listing.originVillage,
    })
    .from(listing)
    .innerJoin(store, eq(listing.storeId, store.id))
    .leftJoin(
      listingTranslations,
      and(
        eq(listingTranslations.listingId, listing.id),
        eq(listingTranslations.locale, locale)
      )
    )
    .where(
      and(
        eq(listing.status, "active"),
        eq(store.isApproved, true),
        eq(store.visibility, "public")
      )
    )
    .orderBy(desc(listing.createdAt))
    .limit(limit);

  return products
    .filter((p) => p.id != null && typeof p.id === "string")
    .map((p) => {
      // Ensure dates are Date objects or null, never undefined
      const createdAt =
        p.createdAt instanceof Date
          ? p.createdAt
          : p.createdAt
            ? new Date(p.createdAt)
            : new Date();
      const updatedAt =
        p.updatedAt instanceof Date
          ? p.updatedAt
          : p.updatedAt
            ? new Date(p.updatedAt)
            : new Date();
      const harvestDate =
        p.harvestDate instanceof Date
          ? p.harvestDate
          : p.harvestDate
            ? new Date(p.harvestDate)
            : null;

      // Ensure arrays are arrays or null, never undefined
      const gallery =
        Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery : null;
      const tags =
        Array.isArray(p.tags) && p.tags.length > 0
          ? p.tags
          : Array.isArray(p.tagsFallback) && p.tagsFallback.length > 0
            ? p.tagsFallback
            : null;

      return {
        id: String(p.id),
        slug: p.slug || null,
        name: String(p.name || p.nameFallback || ""),
        description: p.description || p.descriptionFallback || null,
        category: p.category || null,
        categoryName: p.categoryName || null,
        imageUrl: p.imageUrl || null,
        gallery,
        tags,
        price: String(p.price || "0"),
        compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : null,
        currency: String(p.currency || "NPR"),
        stockQuantity: null,
        unit: p.unit || "kg",
        isActive: p.status === "active",
        isFeatured: Boolean(p.isFeatured ?? false),
        marketType: p.marketType || null,
        originVillage: p.originVillage || p.originVillageFallback || null,
        harvestDate,
        ratingAverage: String(p.ratingAverage || "0"),
        ratingCount: Number(p.ratingCount ?? 0),
        salesCount: Number(p.salesCount ?? 0),
        createdAt,
        updatedAt,
        storeName: p.storeName || null,
        storeSlug: p.storeSlug || null,
      };
    });
}

export interface FeaturedStore {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  ratingAvg: string;
  ratingCount: number;
  followerCount: number;
  bannerUrl: string | null;
}

// Helper function to add timeout to database queries
// Returns null on timeout instead of throwing an error
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  defaultValue: T | null = null
): Promise<T | null> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T | null>((resolve) => {
    timeoutId = setTimeout(() => {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `Query timeout after ${timeoutMs}ms, returning default value`
        );
      }
      resolve(defaultValue);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function getFeaturedStores(options?: {
  limit?: number;
}): Promise<FeaturedStore[]> {
  try {
    const limit = options?.limit || 4;

    // Define the store type from the select
    type StoreRow = {
      id: string;
      storeName: string;
      slug: string;
      logoUrl: string | null;
      ratingAvg: string;
      ratingCount: number;
      followerCount: number;
    };

    // Try query with timeout - Neon free tier can be slow
    let stores: StoreRow[] = [];
    let timeoutId: NodeJS.Timeout;

    try {
      stores = await Promise.race<StoreRow[]>([
        db
          .select({
            id: store.id,
            storeName: store.storeName,
            slug: store.slug,
            logoUrl: store.logoUrl,
            ratingAvg: store.ratingAvg,
            ratingCount: store.ratingCount,
            followerCount: store.followerCount,
          })
          .from(store)
          .where(
            and(eq(store.isApproved, true), eq(store.visibility, "public"))
          )
          .orderBy(desc(store.createdAt))
          .limit(limit),
        new Promise<StoreRow[]>((resolve) => {
          timeoutId = setTimeout(() => {
            if (process.env.NODE_ENV === "development") {
              console.warn(
                "[getFeaturedStores] Query taking too long, returning empty array"
              );
            }
            resolve([]);
          }, 15000); // 15 second timeout for Neon free tier
        }),
      ]);

      // Clear timeout if query completed
      if (timeoutId!) {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (timeoutId!) {
        clearTimeout(timeoutId);
      }
      if (process.env.NODE_ENV === "development") {
        console.error("[getFeaturedStores] Query error:", error);
      }
      stores = [];
    }

    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[getFeaturedStores] Found ${stores?.length || 0} stores`);
    }

    // If stores query timed out or returned null, return empty array
    if (!stores || stores.length === 0) {
      return [];
    }

    // Get first banner image for each store
    const storeIds = stores.map((s) => s.id);
    const banners =
      storeIds.length > 0
        ? (await withTimeout(
            db
              .select({
                storeId: storeBannerImage.storeId,
                imageUrl: storeBannerImage.url,
              })
              .from(storeBannerImage)
              .where(
                and(
                  inArray(storeBannerImage.storeId, storeIds),
                  eq(storeBannerImage.sortOrder, 0)
                )
              ),
            5000, // 5 second timeout for banner query
            [] // Return empty array on timeout
          )) || []
        : [];

    const bannerMap = new Map(banners.map((b) => [b.storeId, b.imageUrl]));

    return stores.map((s) => ({
      ...s,
      bannerUrl: bannerMap.get(s.id) || null,
    }));
  } catch (error) {
    // Only log in development to reduce noise
    if (process.env.NODE_ENV === "development") {
      console.error("Error fetching featured stores:", error);
    }
    // Return empty array on error to prevent page crash
    // This handles connection timeouts gracefully
    return [];
  }
}

export async function getTrendingProductsData(options?: {
  limit?: number;
  locale?: string;
}): Promise<PublicProduct[]> {
  return await getTrendingProducts(
    options?.limit || 6,
    options?.locale || "en"
  );
}
