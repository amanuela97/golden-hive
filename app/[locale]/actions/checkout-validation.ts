"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { listing } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getStoreIdForUser } from "./store-id";

/**
 * Validate if the current user is allowed to checkout with the given listings
 *
 * Rules:
 * - Customers: Can buy from any store ✅
 * - Sellers: Can buy from other stores, but NOT from their own store ❌
 * - Admins: Cannot checkout at all ❌
 * - Guest users: Can checkout (no restrictions) ✅
 *
 * @param listingIds Array of listing IDs in the cart
 * @returns Validation result with allowed status and optional error message
 */
export async function validateCheckoutPermissions(
  listingIds: string[]
): Promise<{
  allowed: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Guest users (not logged in) can always checkout
    if (!session?.user?.id) {
      return { allowed: true };
    }

    // Get user role and storeId
    const { storeId, isAdmin, isCustomer } = await getStoreIdForUser();

    // Block admins from checkout
    if (isAdmin) {
      return {
        allowed: false,
        error:
          "Admin accounts cannot place orders. Please use a customer account to make purchases.",
      };
    }

    // Customers can always checkout
    if (isCustomer) {
      return { allowed: true };
    }

    // For sellers: check if any items are from their own store
    if (storeId && listingIds.length > 0) {
      // Get storeIds for all listings in cart
      const listings = await db
        .select({
          id: listing.id,
          storeId: listing.storeId,
          name: listing.name,
        })
        .from(listing)
        .where(inArray(listing.id, listingIds));

      // Check if any listing belongs to seller's store
      const ownStoreItems = listings.filter((l) => l.storeId === storeId);

      if (ownStoreItems.length > 0) {
        const itemNames = ownStoreItems.map((item) => item.name).join(", ");

        return {
          allowed: false,
          error: `You cannot purchase items from your own store: ${itemNames}. Please remove these items to continue.`,
        };
      }
    }

    // Sellers buying from other stores - allowed
    return { allowed: true };
  } catch (error) {
    console.error("Error validating checkout permissions:", error);
    // On error, allow checkout (fail open) - backend validation will catch it
    return { allowed: true };
  }
}
