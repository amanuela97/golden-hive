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
import { unstable_cache } from "next/cache";

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

// Retry utility function with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = delayMs * Math.pow(2, attempt);
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Internal function to fetch stores from database with retry logic
async function fetchFeaturedStoresFromDB(
  limit: number
): Promise<FeaturedStore[]> {
  type StoreRow = {
    id: string;
    storeName: string;
    slug: string;
    logoUrl: string | null;
    ratingAvg: string;
    ratingCount: number;
    followerCount: number;
  };

  // Fetch stores with retry logic
  const stores = await withRetry(
    async () => {
      return await db
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
        .where(and(eq(store.isApproved, true), eq(store.visibility, "public")))
        .orderBy(desc(store.createdAt))
        .limit(limit);
    },
    3,
    1000
  ); // 3 retries with 1s initial delay (exponential backoff: 1s, 2s, 4s)

  if (!stores || stores.length === 0) {
    return [];
  }

  // Fetch banners (non-critical, so fewer retries)
  const storeIds = stores.map((s) => s.id);
  let banners: Array<{ storeId: string; imageUrl: string }> = [];

  if (storeIds.length > 0) {
    try {
      banners = await withRetry(
        async () => {
          return await db
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
            );
        },
        2,
        500
      ); // 2 retries for banner query (less critical)
    } catch (error) {
      // Log warning but continue without banners
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[getFeaturedStores] Banner query failed, continuing without banners:",
          error
        );
      }
      banners = [];
    }
  }

  const bannerMap = new Map(banners.map((b) => [b.storeId, b.imageUrl]));

  return stores.map((s) => ({
    ...s,
    bannerUrl: bannerMap.get(s.id) || null,
  }));
}

export async function getFeaturedStores(options?: {
  limit?: number;
}): Promise<FeaturedStore[]> {
  const limit = options?.limit || 4;

  try {
    // Cache the result for 1 hour to reduce database load
    // This ensures most requests are served from cache, making it much faster
    // and reducing the chance of timeout issues
    return await unstable_cache(
      async () => {
        return await fetchFeaturedStoresFromDB(limit);
      },
      [`featured-stores-${limit}`],
      {
        revalidate: 3600, // 1 hour cache
        tags: ["featured-stores"],
      }
    )();
  } catch (error) {
    // Log error but return empty array to prevent page crash
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[getFeaturedStores] Error after retries and cache:",
        error
      );
    }
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
