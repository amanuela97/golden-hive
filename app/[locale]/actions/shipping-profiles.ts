"use server";

import { ActionResponse } from "@/lib/types";
import { db } from "@/db";
import {
  shippingProfiles,
  shippingDestinations,
  shippingRates,
  storeMembers,
  userRoles,
  roles,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export interface ShippingProfileData {
  name: string;
  pricingType: "manual" | "calculated";
  originCountry: string;
  originPostalCode?: string;
  processingDaysMin: number;
  processingDaysMax: number;
  isDefault?: boolean;
}

export interface ShippingDestinationData {
  destinationType: "country" | "region" | "everywhere_else";
  countryCode?: string;
  regionCode?: string;
  excluded?: boolean;
}

export interface ShippingRateData {
  serviceName: string;
  freeShipping: boolean;
  firstItemPriceCents?: number;
  additionalItemPriceCents?: number;
  currency?: string;
  transitDaysMin?: number;
  transitDaysMax?: number;
  sortOrder?: number;
}

/**
 * Get store ID for current user
 */
async function getCurrentUserStoreId(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  const storeResult = await db
    .select({ storeId: storeMembers.storeId })
    .from(storeMembers)
    .where(eq(storeMembers.userId, session.user.id))
    .limit(1);

  return storeResult.length > 0 ? storeResult[0].storeId : null;
}

/**
 * Check if user is admin
 */
async function isAdmin(): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return false;
  }

  const userRole = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id))
    .limit(1);

  return userRole.length > 0 && userRole[0].roleName.toLowerCase() === "admin";
}

/**
 * Create a shipping profile
 */
export async function createShippingProfile(
  data: ShippingProfileData
): Promise<ActionResponse & { result?: { id: string } }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (!storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Store not found. Please set up your store first.",
      };
    }

    // Use current user's store
    const finalStoreId = storeId;
    if (!finalStoreId) {
      return {
        success: false,
        error: "Store not found. Please set up your store first.",
      };
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(shippingProfiles)
        .set({ isDefault: false })
        .where(eq(shippingProfiles.storeId, finalStoreId));
    }

    const [profile] = await db
      .insert(shippingProfiles)
      .values({
        storeId: finalStoreId,
        name: data.name,
        pricingType: data.pricingType,
        originCountry: data.originCountry,
        originPostalCode: data.originPostalCode || null,
        processingDaysMin: data.processingDaysMin,
        processingDaysMax: data.processingDaysMax,
        isDefault: data.isDefault || false,
      })
      .returning();

    return {
      success: true,
      result: { id: profile.id },
    };
  } catch (error) {
    console.error("Error creating shipping profile:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create shipping profile",
    };
  }
}

/**
 * Get all shipping profiles for a store
 */
export async function getShippingProfiles(storeId?: string): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      name: string;
      pricingType: string;
      originCountry: string;
      originPostalCode: string | null;
      processingDaysMin: number;
      processingDaysMax: number;
      isDefault: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const userStoreId = await getCurrentUserStoreId();
    const finalStoreId = storeId || userStoreId;

    if (!finalStoreId && !(await isAdmin())) {
      return {
        success: false,
        error: "Store not found",
      };
    }

    const profiles = await db
      .select({
        id: shippingProfiles.id,
        name: shippingProfiles.name,
        pricingType: shippingProfiles.pricingType,
        originCountry: shippingProfiles.originCountry,
        originPostalCode: shippingProfiles.originPostalCode,
        processingDaysMin: shippingProfiles.processingDaysMin,
        processingDaysMax: shippingProfiles.processingDaysMax,
        isDefault: shippingProfiles.isDefault,
        createdAt: shippingProfiles.createdAt,
        updatedAt: shippingProfiles.updatedAt,
      })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.storeId, finalStoreId!))
      .orderBy(desc(shippingProfiles.createdAt));

    return {
      success: true,
      result: profiles,
    };
  } catch (error) {
    console.error("Error fetching shipping profiles:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch shipping profiles",
    };
  }
}

/**
 * Update a shipping profile
 */
export async function updateShippingProfile(
  profileId: string,
  data: Partial<ShippingProfileData>
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify profile belongs to user's store
    const profile = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.id, profileId))
      .limit(1);

    if (profile.length === 0) {
      return {
        success: false,
        error: "Shipping profile not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (profile[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(shippingProfiles)
        .set({ isDefault: false })
        .where(eq(shippingProfiles.storeId, profile[0].storeId));
    }

    await db
      .update(shippingProfiles)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.pricingType && { pricingType: data.pricingType }),
        ...(data.originCountry && { originCountry: data.originCountry }),
        ...(data.originPostalCode !== undefined && {
          originPostalCode: data.originPostalCode || null,
        }),
        ...(data.processingDaysMin !== undefined && {
          processingDaysMin: data.processingDaysMin,
        }),
        ...(data.processingDaysMax !== undefined && {
          processingDaysMax: data.processingDaysMax,
        }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      })
      .where(eq(shippingProfiles.id, profileId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating shipping profile:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update shipping profile",
    };
  }
}

/**
 * Delete a shipping profile
 */
export async function deleteShippingProfile(
  profileId: string
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify profile belongs to user's store
    const profile = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.id, profileId))
      .limit(1);

    if (profile.length === 0) {
      return {
        success: false,
        error: "Shipping profile not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (profile[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    await db.delete(shippingProfiles).where(eq(shippingProfiles.id, profileId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting shipping profile:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete shipping profile",
    };
  }
}

/**
 * Add a destination to a shipping profile
 */
export async function addShippingDestination(
  shippingProfileId: string,
  data: ShippingDestinationData
): Promise<ActionResponse & { result?: { id: string } }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify profile belongs to user's store
    const profile = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.id, shippingProfileId))
      .limit(1);

    if (profile.length === 0) {
      return {
        success: false,
        error: "Shipping profile not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (profile[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Validate country code if destination type is country
    if (data.destinationType === "country" && !data.countryCode) {
      return {
        success: false,
        error: "Country code is required for country destination type",
      };
    }

    const [destination] = await db
      .insert(shippingDestinations)
      .values({
        shippingProfileId,
        destinationType: data.destinationType,
        countryCode: data.countryCode || null,
        regionCode: data.regionCode || null,
        excluded: data.excluded || false,
      })
      .returning();

    return {
      success: true,
      result: { id: destination.id },
    };
  } catch (error) {
    console.error("Error adding shipping destination:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to add shipping destination",
    };
  }
}

/**
 * Update a shipping destination
 */
export async function updateShippingDestination(
  destinationId: string,
  data: Partial<ShippingDestinationData>
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify destination belongs to user's store
    const destination = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingDestinations)
      .innerJoin(
        shippingProfiles,
        eq(shippingDestinations.shippingProfileId, shippingProfiles.id)
      )
      .where(eq(shippingDestinations.id, destinationId))
      .limit(1);

    if (destination.length === 0) {
      return {
        success: false,
        error: "Shipping destination not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (destination[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Validate country code if destination type is country
    if (data.destinationType === "country" && !data.countryCode) {
      return {
        success: false,
        error: "Country code is required for country destination type",
      };
    }

    await db
      .update(shippingDestinations)
      .set({
        ...(data.destinationType && { destinationType: data.destinationType }),
        ...(data.countryCode !== undefined && {
          countryCode: data.countryCode || null,
        }),
        ...(data.regionCode !== undefined && {
          regionCode: data.regionCode || null,
        }),
        ...(data.excluded !== undefined && { excluded: data.excluded }),
      })
      .where(eq(shippingDestinations.id, destinationId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating shipping destination:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update shipping destination",
    };
  }
}

/**
 * Delete a shipping destination
 */
export async function deleteShippingDestination(
  destinationId: string
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify destination belongs to user's store
    const destination = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingDestinations)
      .innerJoin(
        shippingProfiles,
        eq(shippingDestinations.shippingProfileId, shippingProfiles.id)
      )
      .where(eq(shippingDestinations.id, destinationId))
      .limit(1);

    if (destination.length === 0) {
      return {
        success: false,
        error: "Shipping destination not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (destination[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    await db
      .delete(shippingDestinations)
      .where(eq(shippingDestinations.id, destinationId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting shipping destination:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete shipping destination",
    };
  }
}

/**
 * Get destinations for a shipping profile
 */
export async function getShippingDestinations(
  shippingProfileId: string
): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      destinationType: string;
      countryCode: string | null;
      regionCode: string | null;
      excluded: boolean;
      createdAt: Date;
    }>;
  }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify profile belongs to user's store
    const profile = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingProfiles)
      .where(eq(shippingProfiles.id, shippingProfileId))
      .limit(1);

    if (profile.length === 0) {
      return {
        success: false,
        error: "Shipping profile not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (profile[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const destinations = await db
      .select({
        id: shippingDestinations.id,
        destinationType: shippingDestinations.destinationType,
        countryCode: shippingDestinations.countryCode,
        regionCode: shippingDestinations.regionCode,
        excluded: shippingDestinations.excluded,
        createdAt: shippingDestinations.createdAt,
      })
      .from(shippingDestinations)
      .where(eq(shippingDestinations.shippingProfileId, shippingProfileId));

    return {
      success: true,
      result: destinations.map((d) => ({
        ...d,
        excluded: d.excluded ?? false,
      })),
    };
  } catch (error) {
    console.error("Error fetching shipping destinations:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch shipping destinations",
    };
  }
}

/**
 * Add a shipping rate to a destination
 */
export async function addShippingRate(
  destinationId: string,
  data: ShippingRateData
): Promise<ActionResponse & { result?: { id: string } }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify destination belongs to user's store
    const destination = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingDestinations)
      .innerJoin(
        shippingProfiles,
        eq(shippingDestinations.shippingProfileId, shippingProfiles.id)
      )
      .where(eq(shippingDestinations.id, destinationId))
      .limit(1);

    if (destination.length === 0) {
      return {
        success: false,
        error: "Shipping destination not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (destination[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Validate: if not free shipping, firstItemPriceCents is required
    if (!data.freeShipping && !data.firstItemPriceCents) {
      return {
        success: false,
        error: "First item price is required when shipping is not free",
      };
    }

    const [rate] = await db
      .insert(shippingRates)
      .values({
        destinationId,
        serviceName: data.serviceName,
        freeShipping: data.freeShipping,
        firstItemPriceCents: data.freeShipping
          ? null
          : data.firstItemPriceCents || null,
        additionalItemPriceCents: data.additionalItemPriceCents || 0,
        currency: data.currency || "EUR",
        transitDaysMin: data.transitDaysMin || null,
        transitDaysMax: data.transitDaysMax || null,
        sortOrder: data.sortOrder || 0,
      })
      .returning();

    return {
      success: true,
      result: { id: rate.id },
    };
  } catch (error) {
    console.error("Error adding shipping rate:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add shipping rate",
    };
  }
}

/**
 * Update a shipping rate
 */
export async function updateShippingRate(
  rateId: string,
  data: Partial<ShippingRateData>
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify rate belongs to user's store
    const rate = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingRates)
      .innerJoin(
        shippingDestinations,
        eq(shippingRates.destinationId, shippingDestinations.id)
      )
      .innerJoin(
        shippingProfiles,
        eq(shippingDestinations.shippingProfileId, shippingProfiles.id)
      )
      .where(eq(shippingRates.id, rateId))
      .limit(1);

    if (rate.length === 0) {
      return {
        success: false,
        error: "Shipping rate not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (rate[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    await db
      .update(shippingRates)
      .set({
        ...(data.serviceName && { serviceName: data.serviceName }),
        ...(data.freeShipping !== undefined && {
          freeShipping: data.freeShipping,
        }),
        ...(data.firstItemPriceCents !== undefined && {
          firstItemPriceCents: data.freeShipping
            ? null
            : data.firstItemPriceCents || null,
        }),
        ...(data.additionalItemPriceCents !== undefined && {
          additionalItemPriceCents: data.additionalItemPriceCents,
        }),
        ...(data.currency && { currency: data.currency }),
        ...(data.transitDaysMin !== undefined && {
          transitDaysMin: data.transitDaysMin || null,
        }),
        ...(data.transitDaysMax !== undefined && {
          transitDaysMax: data.transitDaysMax || null,
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      })
      .where(eq(shippingRates.id, rateId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating shipping rate:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update shipping rate",
    };
  }
}

/**
 * Delete a shipping rate
 */
export async function deleteShippingRate(
  rateId: string
): Promise<ActionResponse> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify rate belongs to user's store
    const rate = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingRates)
      .innerJoin(
        shippingDestinations,
        eq(shippingRates.destinationId, shippingDestinations.id)
      )
      .innerJoin(
        shippingProfiles,
        eq(shippingDestinations.shippingProfileId, shippingProfiles.id)
      )
      .where(eq(shippingRates.id, rateId))
      .limit(1);

    if (rate.length === 0) {
      return {
        success: false,
        error: "Shipping rate not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (rate[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    await db.delete(shippingRates).where(eq(shippingRates.id, rateId));

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting shipping rate:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete shipping rate",
    };
  }
}

/**
 * Get shipping rates for a destination
 */
export async function getShippingRatesForDestination(
  destinationId: string
): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      serviceName: string;
      freeShipping: boolean;
      firstItemPriceCents: number | null;
      additionalItemPriceCents: number;
      currency: string;
      transitDaysMin: number | null;
      transitDaysMax: number | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }
> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify destination belongs to user's store
    const destination = await db
      .select({ storeId: shippingProfiles.storeId })
      .from(shippingDestinations)
      .innerJoin(
        shippingProfiles,
        eq(shippingDestinations.shippingProfileId, shippingProfiles.id)
      )
      .where(eq(shippingDestinations.id, destinationId))
      .limit(1);

    if (destination.length === 0) {
      return {
        success: false,
        error: "Shipping destination not found",
      };
    }

    const storeId = await getCurrentUserStoreId();
    if (destination[0].storeId !== storeId && !(await isAdmin())) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

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
        createdAt: shippingRates.createdAt,
        updatedAt: shippingRates.updatedAt,
      })
      .from(shippingRates)
      .where(eq(shippingRates.destinationId, destinationId))
      .orderBy(shippingRates.sortOrder);

    return {
      success: true,
      result: rates.map((r) => ({
        ...r,
        additionalItemPriceCents: r.additionalItemPriceCents ?? 0,
      })),
    };
  } catch (error) {
    console.error("Error fetching shipping rates:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch shipping rates",
    };
  }
}
