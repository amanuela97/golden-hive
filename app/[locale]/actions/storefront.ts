"use server";

import { db } from "@/db";
import {
  store,
  storeSlugHistory,
  storeBannerImage,
  storeAbout,
  storePolicies,
  storeFollow,
  storeReview,
  listing,
  user,
  orders,
  orderItems,
  storeMembers,
} from "@/db/schema";
import { eq, and, desc, asc, sql, inArray, or, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

/**
 * Get store by slug (with redirect logic for old slugs)
 */
export async function getStoreBySlug(slug: string) {
  const slugLower = slug.toLowerCase();

  const slugRow = await db
    .select()
    .from(storeSlugHistory)
    .where(eq(storeSlugHistory.slugLower, slugLower))
    .limit(1);

  if (slugRow.length === 0) {
    return { success: false, error: "Store not found", redirect: null };
  }

  const storeData = await db
    .select()
    .from(store)
    .where(eq(store.id, slugRow[0].storeId))
    .limit(1);

  if (storeData.length === 0) {
    return { success: false, error: "Store not found", redirect: null };
  }

  // If old slug, return redirect target
  if (!slugRow[0].isActive) {
    return {
      success: true,
      redirect: storeData[0].slug,
      store: null,
    };
  }

  return {
    success: true,
    redirect: null,
    store: storeData[0],
  };
}

/**
 * List public stores (for /stores directory)
 */
export async function listPublicStores(options?: {
  sortBy?: "followers" | "rating" | "newest";
  search?: string;
  limit?: number;
}) {
  const { sortBy = "followers", search, limit = 50 } = options || {};

  const conditions = [
    eq(store.visibility, "public"),
    eq(store.isApproved, true), // Only show approved stores
  ];

  if (search) {
    conditions.push(
      or(
        sql`LOWER(${store.storeName}) LIKE ${`%${search.toLowerCase()}%`}`,
        sql`LOWER(${store.slug}) LIKE ${`%${search.toLowerCase()}%`}`
      )!
    );
  }

  let orderBy;
  switch (sortBy) {
    case "rating":
      orderBy = desc(store.ratingAvg);
      break;
    case "newest":
      orderBy = desc(store.createdAt);
      break;
    case "followers":
    default:
      orderBy = desc(store.followerCount);
  }

  const stores = await db
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
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit);

  // Get first banner image for each store
  const storeIds = stores.map((s) => s.id);
  const banners = await db
    .select({
      storeId: storeBannerImage.storeId,
      url: storeBannerImage.url,
    })
    .from(storeBannerImage)
    .where(
      and(
        inArray(storeBannerImage.storeId, storeIds),
        eq(storeBannerImage.sortOrder, 0)
      )
    );

  const bannerMap = new Map(banners.map((b) => [b.storeId, b.url]));

  return stores.map((s) => ({
    ...s,
    bannerUrl: bannerMap.get(s.id),
  }));
}

/**
 * Get storefront data (store + banners + about + policies + listings)
 */
export async function getStorefrontData(slug: string) {
  const slugResult = await getStoreBySlug(slug);

  if (!slugResult.success || !slugResult.store) {
    if (slugResult.redirect) {
      return { redirect: slugResult.redirect };
    }
    return null;
  }

  const storeData = slugResult.store;

  // Check if store is approved (unless owner/admin viewing)
  const session = await auth.api.getSession({ headers: await headers() });
  const isOwnerOrAdmin = session?.user?.id
    ? await (async () => {
        const member = await db
          .select()
          .from(storeMembers)
          .where(
            and(
              eq(storeMembers.storeId, storeData.id),
              eq(storeMembers.userId, session.user.id),
              inArray(storeMembers.role, ["admin", "seller"])
            )
          )
          .limit(1);
        return member.length > 0;
      })()
    : false;

  if (!storeData.isApproved && !isOwnerOrAdmin) {
    return null; // Store not approved, don't show to public
  }

  // Check visibility (reuse isOwnerOrAdmin from above)
  if (storeData.visibility === "hidden" && !isOwnerOrAdmin) {
    return null; // Will trigger 404
  }

  // Fetch banners
  const banners = await db
    .select()
    .from(storeBannerImage)
    .where(eq(storeBannerImage.storeId, storeData.id))
    .orderBy(storeBannerImage.sortOrder);

  // Fetch about
  const about = await db
    .select()
    .from(storeAbout)
    .where(eq(storeAbout.storeId, storeData.id))
    .limit(1);

  // Fetch policies
  const policies = await db
    .select()
    .from(storePolicies)
    .where(eq(storePolicies.storeId, storeData.id))
    .limit(1);

  // Fetch initial active listings (first page)
  const listings = await db
    .select()
    .from(listing)
    .where(
      and(
        eq(listing.storeId, storeData.id),
        eq(listing.status, "active")
      )
    )
    .orderBy(desc(listing.createdAt))
    .limit(12);

  // Fetch initial reviews (first page)
  const reviews = await db
    .select({
      id: storeReview.id,
      rating: storeReview.rating,
      title: storeReview.title,
      body: storeReview.body,
      createdAt: storeReview.createdAt,
      userName: user.name,
    })
    .from(storeReview)
    .innerJoin(user, eq(storeReview.userId, user.id))
    .where(eq(storeReview.storeId, storeData.id))
    .orderBy(desc(storeReview.createdAt))
    .limit(10);

  return {
    store: storeData,
    banners,
    about: about[0] || null,
    policies: policies[0] || null,
    listings,
    reviews,
  };
}

/**
 * Get filtered, sorted, and paginated listings for a store
 */
export async function getStoreListings(
  storeId: string,
  options?: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: "relevance" | "newest" | "price-low" | "price-high";
    page?: number;
    limit?: number;
  }
) {
  const {
    search,
    minPrice,
    maxPrice,
    sortBy = "newest",
    page = 1,
    limit = 12,
  } = options || {};

  const conditions = [
    eq(listing.storeId, storeId),
    eq(listing.status, "active"),
  ];

  // Search filter
  if (search) {
    conditions.push(
      or(
        sql`LOWER(${listing.name}) LIKE ${`%${search.toLowerCase()}%`}`,
        sql`LOWER(${listing.description}) LIKE ${`%${search.toLowerCase()}%`}`,
        sql`EXISTS (
          SELECT 1 FROM unnest(${listing.tags}) AS tag
          WHERE LOWER(tag) LIKE ${`%${search.toLowerCase()}%`}
        )`
      )!
    );
  }

  // Price filters
  if (minPrice !== undefined) {
    conditions.push(gte(listing.price, minPrice.toString()));
  }
  if (maxPrice !== undefined) {
    conditions.push(lte(listing.price, maxPrice.toString()));
  }

  // Sort order - always use array for consistency
  let orderByArray: any[];
  switch (sortBy) {
    case "price-low":
      orderByArray = [asc(listing.price)];
      break;
    case "price-high":
      orderByArray = [desc(listing.price)];
      break;
    case "newest":
      orderByArray = [desc(listing.createdAt)];
      break;
    case "relevance":
    default:
      // For relevance, prioritize featured items, then by rating, then by date
      orderByArray = [
        desc(listing.isFeatured),
        desc(listing.ratingAverage),
        desc(listing.createdAt),
      ];
      break;
  }

  const offset = (page - 1) * limit;

  // Get total count for pagination
  const totalCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(listing)
    .where(and(...conditions));

  const totalCount = Number(totalCountResult[0]?.count || 0);

  // Get listings
  const listings = await db
    .select()
    .from(listing)
    .where(and(...conditions))
    .orderBy(...orderByArray)
    .limit(limit)
    .offset(offset);

  return {
    listings,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}

/**
 * Get paginated reviews for a store
 */
export async function getStoreReviews(
  storeId: string,
  options?: {
    page?: number;
    limit?: number;
  }
) {
  const { page = 1, limit = 10 } = options || {};
  const offset = (page - 1) * limit;

  // Get total count
  const totalCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(storeReview)
    .where(eq(storeReview.storeId, storeId));

  const totalCount = Number(totalCountResult[0]?.count || 0);

  // Get reviews
  const reviews = await db
    .select({
      id: storeReview.id,
      rating: storeReview.rating,
      title: storeReview.title,
      body: storeReview.body,
      createdAt: storeReview.createdAt,
      userName: user.name,
    })
    .from(storeReview)
    .innerJoin(user, eq(storeReview.userId, user.id))
    .where(eq(storeReview.storeId, storeId))
    .orderBy(desc(storeReview.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    reviews,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}

/**
 * Follow/unfollow store
 */
export async function toggleStoreFollow(storeId: string): Promise<{
  success: boolean;
  following: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, following: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Check if already following
    const existing = await db
      .select()
      .from(storeFollow)
      .where(
        and(
          eq(storeFollow.storeId, storeId),
          eq(storeFollow.userId, userId)
        )
      )
      .limit(1);

    return await db.transaction(async (tx) => {
      if (existing.length > 0) {
        // Unfollow
        await tx
          .delete(storeFollow)
          .where(
            and(
              eq(storeFollow.storeId, storeId),
              eq(storeFollow.userId, userId)
            )
          );

        // Decrement follower count
        await tx
          .update(store)
          .set({
            followerCount: sql`GREATEST(${store.followerCount} - 1, 0)`,
          })
          .where(eq(store.id, storeId));

        return { success: true, following: false };
      } else {
        // Follow
        await tx.insert(storeFollow).values({
          storeId,
          userId,
        });

        // Increment follower count
        await tx
          .update(store)
          .set({
            followerCount: sql`${store.followerCount} + 1`,
          })
          .where(eq(store.id, storeId));

        return { success: true, following: true };
      }
    });
  } catch (error) {
    console.error("Error toggling follow:", error);
    return {
      success: false,
      following: false,
      error: error instanceof Error ? error.message : "Failed to toggle follow",
    };
  }
}

/**
 * Check if user is following a store
 */
export async function isFollowingStore(storeId: string): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return false;
    }

    const result = await db
      .select()
      .from(storeFollow)
      .where(
        and(
          eq(storeFollow.storeId, storeId),
          eq(storeFollow.userId, session.user.id)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error("Error checking follow status:", error);
    return false;
  }
}

/**
 * Create store review (verified - requires paid order)
 */
export async function createStoreReview(
  storeId: string,
  data: {
    rating: number;
    title?: string;
    body?: string;
    orderId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      return { success: false, error: "Rating must be between 1 and 5" };
    }

    // Verify order (if orderId provided)
    if (data.orderId) {
      const order = await db
        .select()
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(
          and(
            eq(orders.id, data.orderId),
            eq(orders.userId, userId),
            eq(orders.paymentStatus, "paid"),
            eq(listing.storeId, storeId)
          )
        )
        .limit(1);

      if (order.length === 0) {
        return {
          success: false,
          error: "Order not found or not eligible for review",
        };
      }
    } else {
      // Verify user has at least one paid order from this store
      const order = await db
        .select()
        .from(orders)
        .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
        .innerJoin(listing, eq(orderItems.listingId, listing.id))
        .where(
          and(
            eq(orders.userId, userId),
            eq(orders.paymentStatus, "paid"),
            eq(listing.storeId, storeId)
          )
        )
        .limit(1);

      if (order.length === 0) {
        return {
          success: false,
          error: "You must have a paid order from this store to review",
        };
      }
    }

    // Create review and update aggregates in transaction
    return await db.transaction(async (tx) => {
      await tx.insert(storeReview).values({
        storeId,
        userId,
        rating: data.rating,
        title: data.title || null,
        body: data.body || null,
        orderId: data.orderId || null,
      });

      // Update aggregates
      const storeData = await tx
        .select({
          ratingCount: store.ratingCount,
          ratingSum: store.ratingSum,
        })
        .from(store)
        .where(eq(store.id, storeId))
        .limit(1);

      if (storeData.length > 0) {
        const newCount = storeData[0].ratingCount + 1;
        const newSum = storeData[0].ratingSum + data.rating;
        const newAvg = newSum / newCount;

        await tx
          .update(store)
          .set({
            ratingCount: newCount,
            ratingSum: newSum,
            ratingAvg: sql`${newSum}::numeric / ${newCount}::numeric`,
          })
          .where(eq(store.id, storeId));
      }

      return { success: true };
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create review",
    };
  }
}

