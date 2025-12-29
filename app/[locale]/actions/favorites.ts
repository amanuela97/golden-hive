"use server";

import { db } from "@/db";
import {
  listingFavorite,
  storeFollow,
  listing,
  store,
  listingTranslations,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, inArray, desc } from "drizzle-orm";

/**
 * Toggle favorite status for a listing (product)
 */
export async function toggleListingFavorite(listingId: string): Promise<{
  success: boolean;
  isFavorite: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, isFavorite: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Check if already favorited
    const existing = await db
      .select()
      .from(listingFavorite)
      .where(
        and(
          eq(listingFavorite.listingId, listingId),
          eq(listingFavorite.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Remove favorite
      await db
        .delete(listingFavorite)
        .where(
          and(
            eq(listingFavorite.listingId, listingId),
            eq(listingFavorite.userId, userId)
          )
        );

      return { success: true, isFavorite: false };
    } else {
      // Add favorite
      await db.insert(listingFavorite).values({
        listingId,
        userId,
      });

      return { success: true, isFavorite: true };
    }
  } catch (error) {
    console.error("Error toggling listing favorite:", error);
    return {
      success: false,
      isFavorite: false,
      error:
        error instanceof Error ? error.message : "Failed to toggle favorite",
    };
  }
}

/**
 * Check if a listing is favorited by the current user
 */
export async function isListingFavorite(listingId: string): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return false;
    }

    const result = await db
      .select()
      .from(listingFavorite)
      .where(
        and(
          eq(listingFavorite.listingId, listingId),
          eq(listingFavorite.userId, session.user.id)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error("Error checking favorite status:", error);
    return false;
  }
}

/**
 * Get all favorited listings for the current user
 */
export async function getFavoriteListings(locale: string = "en") {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, result: [] };
    }

    const userId = session.user.id;

    // Get favorite listing IDs
    const favorites = await db
      .select({ listingId: listingFavorite.listingId })
      .from(listingFavorite)
      .where(eq(listingFavorite.userId, userId));

    if (favorites.length === 0) {
      return { success: true, result: [] };
    }

    const listingIds = favorites.map((f) => f.listingId);

    // Get listings with translations and favorite timestamps
    const listings = await db
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
        favoritedAt: listingFavorite.createdAt,
      })
      .from(listing)
      .innerJoin(
        listingFavorite,
        and(
          eq(listingFavorite.listingId, listing.id),
          eq(listingFavorite.userId, userId)
        )
      )
      .leftJoin(
        listingTranslations,
        and(
          eq(listingTranslations.listingId, listing.id),
          eq(listingTranslations.locale, locale)
        )
      )
      .leftJoin(store, eq(store.id, listing.storeId))
      .where(and(inArray(listing.id, listingIds), eq(listing.status, "active")))
      .orderBy(desc(listingFavorite.createdAt));

    return { success: true, result: listings };
  } catch (error) {
    console.error("Error fetching favorite listings:", error);
    return { success: false, result: [], error: String(error) };
  }
}

/**
 * Get all followed stores for the current user
 */
export async function getFollowedStores() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, result: [] };
    }

    const userId = session.user.id;

    const stores = await db
      .select({
        id: store.id,
        storeName: store.storeName,
        logoUrl: store.logoUrl,
        slug: store.slug,
        ratingAvg: store.ratingAvg,
        ratingCount: store.ratingCount,
        followerCount: store.followerCount,
        visibility: store.visibility,
        createdAt: store.createdAt,
      })
      .from(store)
      .innerJoin(storeFollow, eq(storeFollow.storeId, store.id))
      .where(
        and(eq(storeFollow.userId, userId), eq(store.visibility, "public"))
      )
      .orderBy(desc(storeFollow.createdAt));

    return { success: true, result: stores };
  } catch (error) {
    console.error("Error fetching followed stores:", error);
    return { success: false, result: [], error: String(error) };
  }
}

/**
 * Get favorite listings and followed stores (for main favorites page)
 */
export async function getFavorites(locale: string = "en") {
  try {
    const [listingsResult, storesResult] = await Promise.all([
      getFavoriteListings(locale),
      getFollowedStores(),
    ]);

    return {
      success: true,
      listings: listingsResult.result || [],
      stores: storesResult.result || [],
    };
  } catch (error) {
    console.error("Error fetching favorites:", error);
    return {
      success: false,
      listings: [],
      stores: [],
      error: String(error),
    };
  }
}
