"use server";

import { db } from "@/db";
import {
  listing,
  shippingProfiles,
  shippingDestinations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function checkShippingAvailability(
  listingId: string,
  countryCode: string
): Promise<{
  available: boolean;
  hasProfile: boolean;
  message?: string;
}> {
  try {
    // Get listing's shipping profile
    const listingResult = await db
      .select({
        shippingProfileId: listing.shippingProfileId,
        storeId: listing.storeId,
      })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!listingResult[0]) {
      return {
        available: false,
        hasProfile: false,
        message: "Product not found",
      };
    }

    let profileId = listingResult[0].shippingProfileId;

    // If no profile, check for store default
    if (!profileId) {
      const defaultProfile = await db
        .select({ id: shippingProfiles.id })
        .from(shippingProfiles)
        .where(
          and(
            eq(shippingProfiles.storeId, listingResult[0].storeId),
            eq(shippingProfiles.isDefault, true)
          )
        )
        .limit(1);

      if (defaultProfile.length === 0) {
        return {
          available: false,
          hasProfile: false,
          message: "No shipping profile configured",
        };
      }
      profileId = defaultProfile[0].id;
    }

    // Check destinations
    const destinations = await db
      .select({
        destinationType: shippingDestinations.destinationType,
        countryCode: shippingDestinations.countryCode,
        excluded: shippingDestinations.excluded,
      })
      .from(shippingDestinations)
      .where(eq(shippingDestinations.shippingProfileId, profileId));

    // Check if country is supported
    const countryMatch = destinations.find(
      (d) =>
        d.destinationType === "country" &&
        d.countryCode === countryCode &&
        !d.excluded
    );

    if (countryMatch) {
      return { available: true, hasProfile: true };
    }

    // Check "everywhere_else"
    const everywhereElse = destinations.find(
      (d) => d.destinationType === "everywhere_else" && !d.excluded
    );

    if (everywhereElse) {
      // Check if country is explicitly excluded
      const isExcluded = destinations.some(
        (d) =>
          d.destinationType === "country" &&
          d.countryCode === countryCode &&
          d.excluded
      );
      return { available: !isExcluded, hasProfile: true };
    }

    return {
      available: false,
      hasProfile: true,
      message: "Shipping not available to this country",
    };
  } catch (error) {
    console.error("Error checking shipping availability:", error);
    return {
      available: false,
      hasProfile: false,
      message: "Error checking availability",
    };
  }
}

