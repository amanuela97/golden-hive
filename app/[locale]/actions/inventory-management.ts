"use server";

import { db } from "@/db";
import {
  inventoryLevels,
  inventoryItems,
  inventoryLocations,
  listingVariants,
  listing,
  inventoryAdjustments,
  user,
  vendor,
  userRoles,
  roles,
} from "@/db/schema";
import { eq, and, sql, like, or, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type InventoryRow = {
  inventoryLevelId: string;
  inventoryItemId: string;
  listingId: string;
  variantId: string;
  productName: string;
  variantTitle: string;
  sku: string | null;
  variantPrice: string | null;
  currency: string;
  locationId: string;
  locationName: string;
  available: number;
  committed: number;
  incoming: number;
  costPerItem: string;
  updatedAt: Date;
};

export type InventoryFilters = {
  locationId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Fetch inventory rows for a vendor with optional filters
 */
export async function getInventoryRows(
  filters: InventoryFilters = {}
): Promise<{
  success: boolean;
  data?: InventoryRow[];
  totalCount?: number;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const isAdmin =
      userRole.length > 0 &&
      userRole[0].roleName.toLowerCase() === "admin";

    // Build where conditions
    const conditions: any[] = [];

    // Only filter by vendor if user is not admin
    if (!isAdmin) {
      // Get vendor for current user
      const vendorResult = await db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.ownerUserId, session.user.id))
        .limit(1);

      if (vendorResult.length === 0) {
        return {
          success: false,
          error: "Vendor not found. Please set up your vendor information.",
        };
      }

      const vendorId = vendorResult[0].id;
      conditions.push(eq(inventoryLocations.vendorId, vendorId));
    }

    if (filters.locationId) {
      conditions.push(eq(inventoryLevels.locationId, filters.locationId));
    }

    // Build search condition if provided
    let searchCondition;
    if (filters.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      searchCondition = or(
        sql`${listing.name} ILIKE ${searchTerm}`,
        sql`${listingVariants.title} ILIKE ${searchTerm}`,
        sql`${listingVariants.sku} ILIKE ${searchTerm}`
      );
    }

    // Get total count
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryLevels)
      .innerJoin(
        inventoryItems,
        eq(inventoryLevels.inventoryItemId, inventoryItems.id)
      )
      .innerJoin(
        listingVariants,
        eq(inventoryItems.variantId, listingVariants.id)
      )
      .innerJoin(listing, eq(listingVariants.listingId, listing.id))
      .innerJoin(
        inventoryLocations,
        eq(inventoryLevels.locationId, inventoryLocations.id)
      )
      .where(
        searchCondition && conditions.length > 0
          ? and(...conditions, searchCondition)
          : searchCondition
            ? searchCondition
            : conditions.length > 0
              ? and(...conditions)
              : undefined
      );

    const countResult = await countQuery;
    const totalCount = countResult[0]?.count || 0;

    // Fetch inventory rows
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const query = db
      .select({
        inventoryLevelId: inventoryLevels.id,
        inventoryItemId: inventoryItems.id,
        listingId: listing.id,
        variantId: listingVariants.id,
        productName: listing.name,
        variantTitle: listingVariants.title,
        sku: listingVariants.sku,
        variantPrice: listingVariants.price,
        currency: listing.currency,
        locationId: inventoryLocations.id,
        locationName: inventoryLocations.name,
        available: inventoryLevels.available,
        committed: inventoryLevels.committed,
        incoming: inventoryLevels.incoming,
        costPerItem: inventoryItems.costPerItem,
        updatedAt: inventoryLevels.updatedAt,
      })
      .from(inventoryLevels)
      .innerJoin(
        inventoryItems,
        eq(inventoryLevels.inventoryItemId, inventoryItems.id)
      )
      .innerJoin(
        listingVariants,
        eq(inventoryItems.variantId, listingVariants.id)
      )
      .innerJoin(listing, eq(listingVariants.listingId, listing.id))
      .innerJoin(
        inventoryLocations,
        eq(inventoryLevels.locationId, inventoryLocations.id)
      )
      .where(
        searchCondition && conditions.length > 0
          ? and(...conditions, searchCondition)
          : searchCondition
            ? searchCondition
            : conditions.length > 0
              ? and(...conditions)
              : undefined
      )
      .orderBy(listing.name, listingVariants.title, inventoryLocations.name)
      .limit(pageSize)
      .offset(offset);

    const rows = await query;

    return {
      success: true,
      data: rows.map((r) => ({
        inventoryLevelId: r.inventoryLevelId,
        inventoryItemId: r.inventoryItemId,
        listingId: r.listingId,
        variantId: r.variantId,
        productName: r.productName || "",
        variantTitle: r.variantTitle,
        sku: r.sku,
        variantPrice: r.variantPrice,
        currency: r.currency || "NPR",
        locationId: r.locationId,
        locationName: r.locationName,
        available: r.available || 0,
        committed: r.committed || 0,
        incoming: r.incoming || 0,
        costPerItem: r.costPerItem || "0",
        updatedAt: r.updatedAt,
      })),
      totalCount,
    };
  } catch (error) {
    console.error("Error fetching inventory rows:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch inventory",
    };
  }
}

/**
 * Get inventory locations for current vendor (or all locations for admin)
 */
export async function getVendorLocations(): Promise<{
  success: boolean;
  data?: Array<{ id: string; name: string }>;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const isAdmin =
      userRole.length > 0 &&
      userRole[0].roleName.toLowerCase() === "admin";

    let locations;
    
    if (isAdmin) {
      // Admin can see all locations
      locations = await db
        .select({
          id: inventoryLocations.id,
          name: inventoryLocations.name,
        })
        .from(inventoryLocations)
        .where(eq(inventoryLocations.isActive, true))
        .orderBy(inventoryLocations.name);
    } else {
      // Get vendor for current user
      const vendorResult = await db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.ownerUserId, session.user.id))
        .limit(1);

      if (vendorResult.length === 0) {
        return { success: false, error: "Vendor not found" };
      }

      const vendorId = vendorResult[0].id;

      locations = await db
        .select({
          id: inventoryLocations.id,
          name: inventoryLocations.name,
        })
        .from(inventoryLocations)
        .where(
          and(
            eq(inventoryLocations.vendorId, vendorId),
            eq(inventoryLocations.isActive, true)
          )
        )
        .orderBy(inventoryLocations.name);
    }

    return {
      success: true,
      data: locations,
    };
  } catch (error) {
    console.error("Error fetching locations:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch locations",
    };
  }
}

/**
 * Adjust inventory quantity for a variant at a location
 */
export async function adjustInventoryQuantity(
  inventoryLevelId: string,
  inventoryItemId: string,
  locationId: string,
  newAvailable: number,
  reason: string = "manual"
): Promise<{
  success: boolean;
  data?: { available: number; updatedAt: Date };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    if (newAvailable < 0) {
      return { success: false, error: "Quantity cannot be negative" };
    }

    // Get current available quantity
    const currentLevel = await db
      .select({ available: inventoryLevels.available })
      .from(inventoryLevels)
      .where(eq(inventoryLevels.id, inventoryLevelId))
      .limit(1);

    if (currentLevel.length === 0) {
      return { success: false, error: "Inventory level not found" };
    }

    const currentAvailable = currentLevel[0].available || 0;
    const change = newAvailable - currentAvailable;

    // If no change, skip
    if (change === 0) {
      return {
        success: true,
        data: {
          available: currentAvailable,
          updatedAt: new Date(),
        },
      };
    }

    // Perform update in transaction
    await db.transaction(async (tx) => {
      // Insert adjustment record
      await tx.insert(inventoryAdjustments).values({
        inventoryItemId,
        locationId,
        change,
        reason,
        createdBy: session.user.id,
      });

      // Update inventory level
      await tx
        .update(inventoryLevels)
        .set({
          available: newAvailable,
          updatedAt: new Date(),
        })
        .where(eq(inventoryLevels.id, inventoryLevelId));
    });

    return {
      success: true,
      data: {
        available: newAvailable,
        updatedAt: new Date(),
      },
    };
  } catch (error) {
    console.error("Error adjusting inventory:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to adjust inventory quantity",
    };
  }
}

/**
 * Update cost per item for an inventory item
 */
export async function updateCostPerItem(
  inventoryItemId: string,
  newCost: number
): Promise<{
  success: boolean;
  data?: { costPerItem: string };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    if (newCost < 0) {
      return { success: false, error: "Cost cannot be negative" };
    }

    // Update cost
    const updated = await db
      .update(inventoryItems)
      .set({
        costPerItem: newCost.toString(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, inventoryItemId))
      .returning({ costPerItem: inventoryItems.costPerItem });

    if (updated.length === 0) {
      return { success: false, error: "Inventory item not found" };
    }

    return {
      success: true,
      data: {
        costPerItem: updated[0].costPerItem || "0",
      },
    };
  } catch (error) {
    console.error("Error updating cost per item:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update cost",
    };
  }
}

/**
 * Update incoming quantity for a variant at a location
 */
export async function updateIncomingQuantity(
  inventoryLevelId: string,
  newIncoming: number
): Promise<{
  success: boolean;
  data?: { incoming: number; updatedAt: Date };
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate input
    if (newIncoming < 0) {
      return { success: false, error: "Quantity cannot be negative" };
    }

    // Update incoming quantity
    const updated = await db
      .update(inventoryLevels)
      .set({
        incoming: newIncoming,
        updatedAt: new Date(),
      })
      .where(eq(inventoryLevels.id, inventoryLevelId))
      .returning({ incoming: inventoryLevels.incoming, updatedAt: inventoryLevels.updatedAt });

    if (updated.length === 0) {
      return { success: false, error: "Inventory level not found" };
    }

    return {
      success: true,
      data: {
        incoming: updated[0].incoming || 0,
        updatedAt: updated[0].updatedAt,
      },
    };
  } catch (error) {
    console.error("Error updating incoming quantity:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update incoming quantity",
    };
  }
}

/**
 * Delete inventory level (removes inventory for a variant at a location)
 */
export async function deleteInventoryLevel(
  inventoryLevelId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    const isAdmin =
      userRole.length > 0 &&
      userRole[0].roleName.toLowerCase() === "admin";

    // Get inventory level with related data to check ownership and get IDs
    const inventoryLevelData = await db
      .select({
        locationId: inventoryLevels.locationId,
        vendorId: inventoryLocations.vendorId,
        inventoryItemId: inventoryLevels.inventoryItemId,
        variantId: inventoryItems.variantId,
      })
      .from(inventoryLevels)
      .innerJoin(
        inventoryLocations,
        eq(inventoryLevels.locationId, inventoryLocations.id)
      )
      .innerJoin(
        inventoryItems,
        eq(inventoryLevels.inventoryItemId, inventoryItems.id)
      )
      .where(eq(inventoryLevels.id, inventoryLevelId))
      .limit(1);

    if (inventoryLevelData.length === 0) {
      return { success: false, error: "Inventory level not found" };
    }

    const { inventoryItemId, variantId, vendorId } = inventoryLevelData[0];

    // Only admin can delete any inventory, or user can delete their own
    if (!isAdmin) {
      const vendorResult = await db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.ownerUserId, session.user.id))
        .limit(1);

      if (vendorResult.length === 0 || vendorId !== vendorResult[0].id) {
        return { success: false, error: "Unauthorized" };
      }
    }

    // Delete the inventory level and cascade cleanup
    await db.transaction(async (tx) => {
      // Delete the inventory level
      await tx
        .delete(inventoryLevels)
        .where(eq(inventoryLevels.id, inventoryLevelId));

      // Check if there are any other inventory levels for this inventory item
      const remainingLevels = await tx
        .select({ id: inventoryLevels.id })
        .from(inventoryLevels)
        .where(eq(inventoryLevels.inventoryItemId, inventoryItemId))
        .limit(1);

      // If no other inventory levels exist for this item, delete the inventory item
      if (remainingLevels.length === 0) {
        await tx
          .delete(inventoryItems)
          .where(eq(inventoryItems.id, inventoryItemId));

        // Check if there are any other inventory items for this variant
        const remainingItems = await tx
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(eq(inventoryItems.variantId, variantId))
          .limit(1);

        // If no other inventory items exist for this variant, delete the variant
        if (remainingItems.length === 0) {
          await tx
            .delete(listingVariants)
            .where(eq(listingVariants.id, variantId));
        }
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting inventory level:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete inventory",
    };
  }
}

/**
 * Get adjustment history for an inventory item at a location
 */
export async function getAdjustmentHistory(
  inventoryItemId: string,
  locationId: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    change: number;
    reason: string | null;
    createdBy: string | null;
    createdByName: string | null;
    createdAt: Date | null;
  }>;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const adjustments = await db
      .select({
        id: inventoryAdjustments.id,
        change: inventoryAdjustments.change,
        reason: inventoryAdjustments.reason,
        createdBy: inventoryAdjustments.createdBy,
        createdByName: user.name,
        createdAt: inventoryAdjustments.createdAt,
      })
      .from(inventoryAdjustments)
      .leftJoin(user, eq(inventoryAdjustments.createdBy, user.id))
      .where(
        and(
          eq(inventoryAdjustments.inventoryItemId, inventoryItemId),
          eq(inventoryAdjustments.locationId, locationId)
        )
      )
      .orderBy(desc(inventoryAdjustments.createdAt))
      .limit(50);

    return {
      success: true,
      data: adjustments,
    };
  } catch (error) {
    console.error("Error fetching adjustment history:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch adjustment history",
    };
  }
}

