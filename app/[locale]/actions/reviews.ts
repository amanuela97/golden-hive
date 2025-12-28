"use server";

import { db } from "@/db";
import {
  productReview,
  storeReview,
  orders,
  orderItems,
  listing,
  store,
  user,
} from "@/db/schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export interface ActionResponse {
  success: boolean;
  error?: string;
}

export interface ProductReviewInput {
  listingId: string;
  orderId: string;
  rating: number; // 1-5
  title?: string;
  comment: string;
  // Guest fields (if not authenticated)
  guestName?: string;
  guestEmail?: string;
}

export interface StoreReviewInput {
  storeId: string;
  orderId: string;
  rating: number; // 1-5
  title?: string;
  body: string;
  // Guest fields (if not authenticated)
  guestName?: string;
  guestEmail?: string;
}

/**
 * Submit a product review
 */
export async function submitProductReview(
  input: ProductReviewInput
): Promise<ActionResponse & { reviewId?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id || null;

    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      return {
        success: false,
        error: "Rating must be between 1 and 5",
      };
    }

    // Validate comment length
    if (!input.comment || input.comment.trim().length < 10) {
      return {
        success: false,
        error: "Comment must be at least 10 characters",
      };
    }

    // For guests, require name and email
    if (!userId) {
      if (!input.guestName || !input.guestEmail) {
        return {
          success: false,
          error: "Name and email are required for guest reviews",
        };
      }
    }

    // Verify order exists and contains the product
    const order = await db
      .select({
        id: orders.id,
        customerEmail: orders.customerEmail,
        paymentStatus: orders.paymentStatus,
        storeId: orders.storeId,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (order.length === 0) {
      return {
        success: false,
        error: "Order not found",
      };
    }

    // Verify order is paid
    if (order[0].paymentStatus !== "paid") {
      return {
        success: false,
        error: "You can only review products from paid orders",
      };
    }

    // Verify product is in the order
    const orderItem = await db
      .select({ listingId: orderItems.listingId })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.orderId, input.orderId),
          eq(orderItems.listingId, input.listingId)
        )
      )
      .limit(1);

    if (orderItem.length === 0) {
      return {
        success: false,
        error: "Product not found in this order",
      };
    }

    // Get product and store info
    const product = await db
      .select({
        id: listing.id,
        storeId: listing.storeId,
      })
      .from(listing)
      .where(eq(listing.id, input.listingId))
      .limit(1);

    if (product.length === 0) {
      return {
        success: false,
        error: "Product not found",
      };
    }

    const productStoreId = product[0].storeId;
    if (!productStoreId) {
      return {
        success: false,
        error: "Product store not found",
      };
    }

    // Verify order store matches product store
    if (order[0].storeId !== productStoreId) {
      return {
        success: false,
        error: "Order and product store mismatch",
      };
    }

    // Check if review already exists for this order/product
    const existingReview = await db
      .select({ id: productReview.id })
      .from(productReview)
      .where(
        and(
          eq(productReview.orderId, input.orderId),
          eq(productReview.listingId, input.listingId)
        )
      )
      .limit(1);

    if (existingReview.length > 0) {
      return {
        success: false,
        error: "You have already reviewed this product for this order",
      };
    }

    // Verify guest email matches order email (if guest)
    if (!userId && order[0].customerEmail) {
      if (
        input.guestEmail?.toLowerCase() !==
        order[0].customerEmail.toLowerCase()
      ) {
        return {
          success: false,
          error: "Email does not match the order email",
        };
      }
    }

    return await db.transaction(async (tx) => {
      // Create review
      const newReview = await tx
        .insert(productReview)
        .values({
          listingId: input.listingId,
          storeId: productStoreId,
          userId: userId || null,
          guestName: !userId ? input.guestName || null : null,
          guestEmail: !userId ? input.guestEmail || null : null,
          rating: input.rating,
          title: input.title || null,
          comment: input.comment.trim(),
          orderId: input.orderId,
          verified: true,
        })
        .returning();

      // Update product rating aggregates
      await updateProductRatingAggregates(tx, input.listingId);

      return {
        success: true,
        reviewId: newReview[0].id,
      };
    });
  } catch (error) {
    console.error("Error submitting product review:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit review",
    };
  }
}

/**
 * Submit a store review
 */
export async function submitStoreReview(
  input: StoreReviewInput
): Promise<ActionResponse & { reviewId?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id || null;

    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      return {
        success: false,
        error: "Rating must be between 1 and 5",
      };
    }

    // Validate body length
    if (!input.body || input.body.trim().length < 10) {
      return {
        success: false,
        error: "Review must be at least 10 characters",
      };
    }

    // For guests, require name and email
    if (!userId) {
      if (!input.guestName || !input.guestEmail) {
        return {
          success: false,
          error: "Name and email are required for guest reviews",
        };
      }
    }

    // Verify order exists and belongs to store
    const order = await db
      .select({
        id: orders.id,
        customerEmail: orders.customerEmail,
        paymentStatus: orders.paymentStatus,
        storeId: orders.storeId,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (order.length === 0) {
      return {
        success: false,
        error: "Order not found",
      };
    }

    // Verify order is paid
    if (order[0].paymentStatus !== "paid") {
      return {
        success: false,
        error: "You can only review stores from paid orders",
      };
    }

    // Verify order belongs to the store
    if (order[0].storeId !== input.storeId) {
      return {
        success: false,
        error: "Order does not belong to this store",
      };
    }

    // Check if review already exists for this order/store
    const existingReview = await db
      .select({ id: storeReview.id })
      .from(storeReview)
      .where(
        and(
          eq(storeReview.orderId, input.orderId),
          eq(storeReview.storeId, input.storeId)
        )
      )
      .limit(1);

    if (existingReview.length > 0) {
      return {
        success: false,
        error: "You have already reviewed this store for this order",
      };
    }

    // Verify guest email matches order email (if guest)
    if (!userId && order[0].customerEmail) {
      if (
        input.guestEmail?.toLowerCase() !==
        order[0].customerEmail.toLowerCase()
      ) {
        return {
          success: false,
          error: "Email does not match the order email",
        };
      }
    }

    return await db.transaction(async (tx) => {
      // Create review
      const newReview = await tx
        .insert(storeReview)
        .values({
          storeId: input.storeId,
          userId: userId || null,
          guestName: !userId ? input.guestName || null : null,
          guestEmail: !userId ? input.guestEmail || null : null,
          rating: input.rating,
          title: input.title || null,
          body: input.body.trim(),
          orderId: input.orderId,
          verified: true,
        })
        .returning();

      // Update store rating aggregates
      await updateStoreRatingAggregates(tx, input.storeId);

      return {
        success: true,
        reviewId: newReview[0].id,
      };
    });
  } catch (error) {
    console.error("Error submitting store review:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit review",
    };
  }
}

/**
 * Get product reviews
 */
export async function getProductReviews(listingId: string) {
  try {
    const reviews = await db
      .select({
        id: productReview.id,
        rating: productReview.rating,
        title: productReview.title,
        comment: productReview.comment,
        verified: productReview.verified,
        createdAt: productReview.createdAt,
        // User info
        userId: productReview.userId,
        userName: user.name,
        userEmail: user.email,
        // Guest info
        guestName: productReview.guestName,
        guestEmail: productReview.guestEmail,
      })
      .from(productReview)
      .leftJoin(user, eq(productReview.userId, user.id))
      .where(eq(productReview.listingId, listingId))
      .orderBy(desc(productReview.createdAt));

    return {
      success: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        verified: r.verified,
        createdAt: r.createdAt,
        reviewerName: r.userName || r.guestName || "Anonymous",
        reviewerEmail: r.userEmail || r.guestEmail || null,
        isGuest: !r.userId,
      })),
    };
  } catch (error) {
    console.error("Error fetching product reviews:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reviews",
      reviews: [],
    };
  }
}

/**
 * Get store reviews
 */
export async function getStoreReviews(storeId: string) {
  try {
    const reviews = await db
      .select({
        id: storeReview.id,
        rating: storeReview.rating,
        title: storeReview.title,
        body: storeReview.body,
        verified: storeReview.verified,
        createdAt: storeReview.createdAt,
        // User info
        userId: storeReview.userId,
        userName: user.name,
        userEmail: user.email,
        // Guest info
        guestName: storeReview.guestName,
        guestEmail: storeReview.guestEmail,
      })
      .from(storeReview)
      .leftJoin(user, eq(storeReview.userId, user.id))
      .where(eq(storeReview.storeId, storeId))
      .orderBy(desc(storeReview.createdAt));

    return {
      success: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        verified: r.verified,
        createdAt: r.createdAt,
        reviewerName: r.userName || r.guestName || "Anonymous",
        reviewerEmail: r.userEmail || r.guestEmail || null,
        isGuest: !r.userId,
        userId: r.userId,
      })),
    };
  } catch (error) {
    console.error("Error fetching store reviews:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reviews",
      reviews: [],
    };
  }
}

/**
 * Delete a product review (only by reviewer or admin)
 */
export async function deleteProductReview(
  reviewId: string
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Get review
    const review = await db
      .select({
        id: productReview.id,
        listingId: productReview.listingId,
        userId: productReview.userId,
      })
      .from(productReview)
      .where(eq(productReview.id, reviewId))
      .limit(1);

    if (review.length === 0) {
      return {
        success: false,
        error: "Review not found",
      };
    }

    // Check permissions (reviewer or admin)
    const isReviewer = review[0].userId === session.user.id;
    const isAdmin = session.user.role === "admin";

    if (!isReviewer && !isAdmin) {
      return {
        success: false,
        error: "You don't have permission to delete this review",
      };
    }

    return await db.transaction(async (tx) => {
      // Delete review
      await tx.delete(productReview).where(eq(productReview.id, reviewId));

      // Update product rating aggregates
      if (review[0].listingId) {
        await updateProductRatingAggregates(tx, review[0].listingId);
      }

      return {
        success: true,
      };
    });
  } catch (error) {
    console.error("Error deleting product review:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete review",
    };
  }
}

/**
 * Delete a store review (only by reviewer or admin)
 */
export async function deleteStoreReview(
  reviewId: string
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    // Get review
    const review = await db
      .select({
        id: storeReview.id,
        storeId: storeReview.storeId,
        userId: storeReview.userId,
      })
      .from(storeReview)
      .where(eq(storeReview.id, reviewId))
      .limit(1);

    if (review.length === 0) {
      return {
        success: false,
        error: "Review not found",
      };
    }

    // Check permissions (reviewer or admin)
    const isReviewer = review[0].userId === session.user.id;
    const isAdmin = session.user.role === "admin";

    if (!isReviewer && !isAdmin) {
      return {
        success: false,
        error: "You don't have permission to delete this review",
      };
    }

    return await db.transaction(async (tx) => {
      // Delete review
      await tx.delete(storeReview).where(eq(storeReview.id, reviewId));

      // Update store rating aggregates
      if (review[0].storeId) {
        await updateStoreRatingAggregates(tx, review[0].storeId);
      }

      return {
        success: true,
      };
    });
  } catch (error) {
    console.error("Error deleting store review:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete review",
    };
  }
}

/**
 * Check if user can review a product (has completed order)
 */
export async function canReviewProduct(
  listingId: string,
  orderId?: string
): Promise<{ canReview: boolean; reason?: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    // If orderId provided, check if it contains the product and is paid
    if (orderId) {
      const order = await db
        .select({
          paymentStatus: orders.paymentStatus,
          customerEmail: orders.customerEmail,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (order.length === 0) {
        return { canReview: false, reason: "Order not found" };
      }

      if (order[0].paymentStatus !== "paid") {
        return {
          canReview: false,
          reason: "Order must be paid before reviewing",
        };
      }

      // Check if product is in order
      const orderItem = await db
        .select({ listingId: orderItems.listingId })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            eq(orderItems.listingId, listingId)
          )
        )
        .limit(1);

      if (orderItem.length === 0) {
        return {
          canReview: false,
          reason: "Product not found in this order",
        };
      }

      // Check if already reviewed
      const existingReview = await db
        .select({ id: productReview.id })
        .from(productReview)
        .where(
          and(
            eq(productReview.orderId, orderId),
            eq(productReview.listingId, listingId)
          )
        )
        .limit(1);

      if (existingReview.length > 0) {
        return { canReview: false, reason: "Already reviewed" };
      }

      return { canReview: true };
    }

    // If no orderId, check if user has any paid orders with this product
    if (!userId) {
      return {
        canReview: false,
        reason: "Order ID required for guest reviews",
      };
    }

    const paidOrders = await db
      .select({ orderId: orderItems.orderId })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.listingId, listingId),
          eq(orders.userId, userId),
          eq(orders.paymentStatus, "paid")
        )
      )
      .limit(1);

    if (paidOrders.length === 0) {
      return {
        canReview: false,
        reason: "You must purchase this product to review it",
      };
    }

    return { canReview: true };
  } catch (error) {
    console.error("Error checking review eligibility:", error);
    return {
      canReview: false,
      reason: "Error checking eligibility",
    };
  }
}

/**
 * Update product rating aggregates
 */
async function updateProductRatingAggregates(
  tx: any,
  listingId: string
): Promise<void> {
  const stats = await tx
    .select({
      avg: sql<number>`COALESCE(AVG(${productReview.rating})::numeric, 0)`,
      count: sql<number>`COUNT(*)::int`,
      sum: sql<number>`COALESCE(SUM(${productReview.rating})::int, 0)`,
    })
    .from(productReview)
    .where(eq(productReview.listingId, listingId));

  const avg = stats[0]?.avg || 0;
  const count = stats[0]?.count || 0;
  const sum = stats[0]?.sum || 0;

  await tx
    .update(listing)
    .set({
      ratingAverage: avg.toString(),
      ratingCount: count,
    })
    .where(eq(listing.id, listingId));
}

/**
 * Update store rating aggregates
 */
async function updateStoreRatingAggregates(
  tx: any,
  storeId: string
): Promise<void> {
  const stats = await tx
    .select({
      avg: sql<number>`COALESCE(AVG(${storeReview.rating})::numeric, 0)`,
      count: sql<number>`COUNT(*)::int`,
      sum: sql<number>`COALESCE(SUM(${storeReview.rating})::int, 0)`,
    })
    .from(storeReview)
    .where(eq(storeReview.storeId, storeId));

  const avg = stats[0]?.avg || 0;
  const count = stats[0]?.count || 0;
  const sum = stats[0]?.sum || 0;

  await tx
    .update(store)
    .set({
      ratingAvg: avg.toString(),
      ratingCount: count,
      ratingSum: sum,
    })
    .where(eq(store.id, storeId));
}

