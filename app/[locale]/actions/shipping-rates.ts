"use server";

import { db } from "@/db";
import {
  store,
  listing,
  shippingProfiles,
  shippingDestinations,
  shippingRates,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

interface OrderItemWithShipping {
  listingId: string;
  variantId: string | null;
  quantity: number;
  storeId: string;
}

/**
 * Get manual shipping rates for order items (using profiles)
 */
export async function getManualShippingRatesForOrder(
  items: OrderItemWithShipping[],
  toCountry: string // Customer's shipping country
): Promise<{
  success: boolean;
  rates?: Array<{
    storeId: string;
    storeName: string;
    rates: Array<{
      id: string;
      serviceName: string;
      priceCents: number;
      currency: string;
      estimatedDays?: { min: number; max: number };
    }>;
  }>;
  error?: string;
}> {
  try {
    // If items don't have storeId, fetch from listings
    const itemsWithStoreId = await Promise.all(
      items.map(async (item) => {
        if (item.storeId) {
          return item;
        }
        // Fetch storeId and shippingProfileId from listing
        const listingData = await db
          .select({
            storeId: listing.storeId,
            shippingProfileId: listing.shippingProfileId,
          })
          .from(listing)
          .where(eq(listing.id, item.listingId))
          .limit(1);

        if (listingData.length > 0 && listingData[0].storeId) {
          return {
            ...item,
            storeId: listingData[0].storeId,
            shippingProfileId: listingData[0].shippingProfileId,
          };
        }
        return null;
      })
    );

    // Filter out items without storeId
    const validItems = itemsWithStoreId.filter(
      (
        item
      ): item is OrderItemWithShipping & {
        shippingProfileId?: string | null;
      } => item !== null
    );

    if (validItems.length === 0) {
      return {
        success: false,
        error: "No items with valid store information",
      };
    }

    // Group items by storeId
    const itemsByStore = validItems.reduce(
      (acc, item) => {
        if (!acc[item.storeId]) {
          acc[item.storeId] = [];
        }
        acc[item.storeId].push(item);
        return acc;
      },
      {} as Record<string, typeof validItems>
    );

    // Get store information
    const storeIds = Object.keys(itemsByStore).filter(
      (id) => id && id.trim() !== ""
    );

    if (storeIds.length === 0) {
      return {
        success: false,
        error: "No valid store IDs found",
      };
    }

    const stores = await db
      .select({
        id: store.id,
        storeName: store.storeName,
      })
      .from(store)
      .where(inArray(store.id, storeIds));

    const storeMap = new Map(stores.map((s) => [s.id, s]));

    // Calculate rates per store
    const ratesByStore = await Promise.all(
      Object.entries(itemsByStore).map(async ([storeId, storeItems]) => {
        const storeInfo = storeMap.get(storeId);
        if (!storeInfo) {
          return null;
        }

        // Get shipping profile for items in this store
        // Use the first item's profile, or find default profile
        const firstItem = storeItems[0];
        let profileId = firstItem.shippingProfileId;

        // If no profile on listing, get default profile for store
        if (!profileId) {
          const defaultProfile = await db
            .select({ id: shippingProfiles.id })
            .from(shippingProfiles)
            .where(
              and(
                eq(shippingProfiles.storeId, storeId),
                eq(shippingProfiles.isDefault, true)
              )
            )
            .limit(1);

          if (defaultProfile.length > 0) {
            profileId = defaultProfile[0].id;
          }
        }

        if (!profileId) {
          return {
            storeId,
            storeName: storeInfo.storeName,
            rates: [],
          };
        }

        // Find matching destination for customer's country
        const destinations = await db
          .select({
            id: shippingDestinations.id,
            destinationType: shippingDestinations.destinationType,
            countryCode: shippingDestinations.countryCode,
            excluded: shippingDestinations.excluded,
          })
          .from(shippingDestinations)
          .where(eq(shippingDestinations.shippingProfileId, profileId));

        // Find matching destination
        let matchingDestination = destinations.find(
          (dest) =>
            dest.destinationType === "country" &&
            dest.countryCode === toCountry &&
            !dest.excluded
        );

        // If no country match, try "everywhere_else"
        if (!matchingDestination) {
          matchingDestination = destinations.find(
            (dest) =>
              dest.destinationType === "everywhere_else" && !dest.excluded
          );
        }

        if (!matchingDestination) {
          return {
            storeId,
            storeName: storeInfo.storeName,
            rates: [],
          };
        }

        // Get rates for this destination
        const rates = await db
          .select({
            id: shippingRates.id,
            serviceName: shippingRates.serviceName,
            freeShipping: shippingRates.freeShipping,
            firstItemPriceCents: shippingRates.firstItemPriceCents,
            additionalItemPriceCents: shippingRates.additionalItemPriceCents,
            currency: shippingRates.currency,
            transitDaysMin: shippingRates.transitDaysMin,
            transitDaysMax: shippingRates.transitDaysMax,
            sortOrder: shippingRates.sortOrder,
          })
          .from(shippingRates)
          .where(eq(shippingRates.destinationId, matchingDestination.id))
          .orderBy(shippingRates.sortOrder);

        // Calculate prices for each rate based on item count
        const itemCount = storeItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        const calculatedRates = rates.map((rate) => {
          let priceCents = 0;

          if (rate.freeShipping) {
            priceCents = 0;
          } else {
            // First item price + (additional items * additional item price)
            const firstItemPrice = rate.firstItemPriceCents || 0;
            const additionalItemPrice = rate.additionalItemPriceCents || 0;
            priceCents = firstItemPrice + (itemCount - 1) * additionalItemPrice;
          }

          return {
            id: rate.id,
            serviceName: rate.serviceName,
            priceCents,
            currency: rate.currency,
            estimatedDays:
              rate.transitDaysMin && rate.transitDaysMax
                ? { min: rate.transitDaysMin, max: rate.transitDaysMax }
                : undefined,
          };
        });

        return {
          storeId,
          storeName: storeInfo.storeName,
          rates: calculatedRates,
        };
      })
    );

    return {
      success: true,
      rates: ratesByStore.filter((r): r is NonNullable<typeof r> => r !== null),
    };
  } catch (error) {
    console.error("Error getting manual shipping rates:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get manual shipping rates",
    };
  }
}
