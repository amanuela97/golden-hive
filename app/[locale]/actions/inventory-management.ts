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
  store,
  storeMembers,
  userRoles,
  roles,
} from "@/db/schema";
import { eq, and, sql, or, desc, inArray } from "drizzle-orm";
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
  onHand: number;
  shipped: number;
  damaged: number;
  returned: number;
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
 * Fetch inventory rows for a store with optional filters
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
      userRole.length > 0 && userRole[0].roleName.toLowerCase() === "admin";

    // Build where conditions
    const conditions: Array<ReturnType<typeof eq>> = [];

    // Only filter by store if user is not admin
    if (!isAdmin) {
      // Get store for current user
      const storeResult = await db
        .select({ id: store.id })
        .from(storeMembers)
        .innerJoin(store, eq(storeMembers.storeId, store.id))
        .where(eq(storeMembers.userId, session.user.id))
        .limit(1);

      if (storeResult.length === 0) {
        return {
          success: false,
          error: "Store not found. Please set up your store information.",
        };
      }

      const storeId = storeResult[0].id;
      conditions.push(eq(inventoryLocations.storeId, storeId));
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
        onHand: inventoryLevels.onHand,
        shipped: inventoryLevels.shipped,
        damaged: inventoryLevels.damaged,
        returned: inventoryLevels.returned,
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
        onHand: r.onHand || 0,
        shipped: r.shipped || 0,
        damaged: r.damaged || 0,
        returned: r.returned || 0,
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
 * Get inventory locations for current store (or all locations for admin)
 */
export async function getStoreLocations(): Promise<{
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
      userRole.length > 0 && userRole[0].roleName.toLowerCase() === "admin";

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
      // Get store for current user
      const storeResult = await db
        .select({ id: store.id })
        .from(storeMembers)
        .innerJoin(store, eq(storeMembers.storeId, store.id))
        .where(eq(storeMembers.userId, session.user.id))
        .limit(1);

      if (storeResult.length === 0) {
        return { success: false, error: "Store not found" };
      }

      const storeId = storeResult[0].id;

      locations = await db
        .select({
          id: inventoryLocations.id,
          name: inventoryLocations.name,
        })
        .from(inventoryLocations)
        .where(
          and(
            eq(inventoryLocations.storeId, storeId),
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

    // Perform update in transaction with row locking
    await db.transaction(async (tx) => {
      // Get current level (row locking handled by transaction)
      const currentLevel = await tx
        .select({
          available: inventoryLevels.available,
          committed: inventoryLevels.committed,
        })
        .from(inventoryLevels)
        .where(eq(inventoryLevels.id, inventoryLevelId))
        .limit(1);

      if (currentLevel.length === 0) {
        throw new Error("Inventory level not found");
      }

      const currentAvailable = currentLevel[0].available || 0;
      const change = newAvailable - currentAvailable;

      // If no change, skip
      if (change === 0) {
        return;
      }

      // Insert ledger entry FIRST
      await tx.insert(inventoryAdjustments).values({
        inventoryItemId,
        locationId,
        change,
        reason,
        eventType: "adjustment",
        referenceType: "manual",
        referenceId: null,
        createdBy: session.user.id,
      });

      // Update snapshot SECOND (calculate on_hand)
      await tx
        .update(inventoryLevels)
        .set({
          available: newAvailable,
          onHand: sql`${newAvailable} + ${inventoryLevels.committed}`, // Calculate on_hand
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
      .returning();

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
      error: error instanceof Error ? error.message : "Failed to update cost",
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

    // Perform update in transaction with row locking
    let result: { incoming: number; updatedAt: Date } | null = null;

    await db.transaction(async (tx) => {
      // Get current level (row locking handled by transaction)
      const currentLevel = await tx
        .select({
          incoming: inventoryLevels.incoming,
          inventoryItemId: inventoryLevels.inventoryItemId,
          locationId: inventoryLevels.locationId,
        })
        .from(inventoryLevels)
        .where(eq(inventoryLevels.id, inventoryLevelId))
        .limit(1);

      if (currentLevel.length === 0) {
        throw new Error("Inventory level not found");
      }

      const currentIncoming = currentLevel[0].incoming || 0;
      const change = newIncoming - currentIncoming;

      // If no change, skip
      if (change === 0) {
        result = {
          incoming: currentIncoming,
          updatedAt: new Date(),
        };
        return;
      }

      // Insert ledger entry FIRST (only if there's a change)
      if (change !== 0) {
        await tx.insert(inventoryAdjustments).values({
          inventoryItemId: currentLevel[0].inventoryItemId,
          locationId: currentLevel[0].locationId,
          change: change, // Positive for increase, negative for decrease
          reason: "incoming_stock_adjustment",
          eventType: "restock",
          referenceType: "supplier",
          referenceId: null,
          createdBy: session.user.id,
        });
      }

      // Update snapshot SECOND
      const updated = await tx
        .update(inventoryLevels)
        .set({
          incoming: newIncoming,
          updatedAt: new Date(),
        })
        .where(eq(inventoryLevels.id, inventoryLevelId))
        .returning();

      if (updated.length > 0) {
        result = {
          incoming: updated[0].incoming || 0,
          updatedAt: updated[0].updatedAt,
        };
      }
    });

    if (!result) {
      return { success: false, error: "Failed to update incoming quantity" };
    }

    return {
      success: true,
      data: result,
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
export async function deleteInventoryLevel(inventoryLevelId: string): Promise<{
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
      userRole.length > 0 && userRole[0].roleName.toLowerCase() === "admin";

    // Get inventory level with related data to check ownership and get IDs
    const inventoryLevelData = await db
      .select({
        locationId: inventoryLevels.locationId,
        storeId: inventoryLocations.storeId,
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

    const { inventoryItemId, variantId, storeId } = inventoryLevelData[0];

    // Only admin can delete any inventory, or user can delete their own
    if (!isAdmin) {
      const storeResult = await db
        .select({ id: store.id })
        .from(storeMembers)
        .innerJoin(store, eq(storeMembers.storeId, store.id))
        .where(eq(storeMembers.userId, session.user.id))
        .limit(1);

      if (storeResult.length === 0 || storeId !== storeResult[0].id) {
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
 * Get inventory updates for realtime sync
 * Returns current state of inventory for specified variants
 */
export async function getInventoryUpdates(
  variantIds: string[],
  locationId?: string
): Promise<{
  success: boolean;
  data?: Array<{
    variantId: string;
    available: number;
    committed: number;
    onHand: number;
    shipped: number;
    updatedAt: Date;
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

    // Get user role and store
    const userRoleData = await db
      .select({
        roleName: roles.name,
        storeId: store.id,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(storeMembers, eq(storeMembers.userId, userRoles.userId))
      .leftJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(userRoles.userId, session.user.id))
      .limit(1);

    if (userRoleData.length === 0) {
      return { success: false, error: "User role not found" };
    }

    const userRole = userRoleData[0].roleName;
    const storeId = userRoleData[0].storeId;

    // Build conditions
    const conditions = [];

    // Filter by store for sellers
    if (userRole !== "admin" && storeId) {
      conditions.push(eq(listing.storeId, storeId));
    }

    // Filter by location if provided
    if (locationId) {
      conditions.push(eq(inventoryLevels.locationId, locationId));
    }

    // Filter by variant IDs
    if (variantIds.length > 0) {
      conditions.push(inArray(listingVariants.id, variantIds));
    }

    // Query inventory levels
    const updates = await db
      .select({
        variantId: listingVariants.id,
        available: inventoryLevels.available,
        committed: inventoryLevels.committed,
        onHand: inventoryLevels.onHand,
        shipped: inventoryLevels.shipped,
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
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      success: true,
      data: updates.map((u) => ({
        variantId: u.variantId,
        available: u.available || 0,
        committed: u.committed || 0,
        onHand: u.onHand || 0,
        shipped: u.shipped || 0,
        updatedAt: u.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Error fetching inventory updates:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch inventory updates",
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
    eventType: string | null;
    referenceType: string | null;
    referenceId: string | null;
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
        eventType: inventoryAdjustments.eventType,
        referenceType: inventoryAdjustments.referenceType,
        referenceId: inventoryAdjustments.referenceId,
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
