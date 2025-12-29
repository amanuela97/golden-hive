"use server";

import { ActionResponse } from "@/lib/types";
import { db } from "@/db";
import {
  inventoryLocations,
  store,
  storeMembers,
  userRoles,
  roles,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Data type for creating/updating inventory locations
// This is a DTO (Data Transfer Object) for input, not the full schema type
export interface InventoryLocationData {
  name: string;
  address?: string;
  phone?: string;
  fulfillmentRules?: string;
  isActive?: boolean;
}

/**
 * Get active inventory locations for a store
 * Used for product form location selection
 * @param producerId - Optional producer ID. If provided, fetches locations for that producer's store.
 *                     If not provided, fetches locations for the current user's store.
 * @param storeId - Optional store ID. If provided, uses this directly (preferred over producerId lookup).
 */
export async function getInventoryLocations(
  producerId?: string,
  storeId?: string
): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      name: string;
      address: string | null;
      isActive: boolean;
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

    let finalStoreId: string | null = null;

    // If storeId is provided directly, use it (preferred method)
    if (storeId) {
      // Verify the store exists
      const storeCheck = await db
        .select({ id: store.id })
        .from(store)
        .where(eq(store.id, storeId))
        .limit(1);

      if (storeCheck.length > 0) {
        finalStoreId = storeId;
      }
    } else if (producerId) {
      // If producerId is provided, get store for that producer (for admin editing seller's products)
      const storeResult = await db
        .select({ id: store.id })
        .from(storeMembers)
        .innerJoin(store, eq(storeMembers.storeId, store.id))
        .where(eq(storeMembers.userId, producerId))
        .limit(1);

      if (storeResult.length > 0) {
        finalStoreId = storeResult[0].id;
      } else if (!isAdmin) {
        // Non-admin users need a store
        return {
          success: false,
          error: "Store not found for the specified producer.",
        };
      }
    } else {
      // Get store for current user through storeMembers
      const storeResult = await db
        .select({ id: store.id })
        .from(storeMembers)
        .innerJoin(store, eq(storeMembers.storeId, store.id))
        .where(eq(storeMembers.userId, session.user.id))
        .limit(1);

      if (storeResult.length > 0) {
        finalStoreId = storeResult[0].id;
      } else if (!isAdmin) {
        // Non-admin users need a store
        return {
          success: false,
          error: "Store not found. Please set up your store information first.",
        };
      }
    }

    // Build query conditions
    const conditions = [eq(inventoryLocations.isActive, true)];

    // If we have a finalStoreId, filter by it. Admins without finalStoreId see all locations.
    if (finalStoreId) {
      conditions.push(eq(inventoryLocations.storeId, finalStoreId));
    }

    // Get only active locations (for product form)
    const locations = await db
      .select({
        id: inventoryLocations.id,
        name: inventoryLocations.name,
        address: inventoryLocations.address,
        isActive: inventoryLocations.isActive,
      })
      .from(inventoryLocations)
      .where(and(...conditions))
      .orderBy(inventoryLocations.name);

    return {
      success: true,
      result: locations.map((loc) => ({
        ...loc,
        isActive: loc.isActive ?? true,
      })),
    };
  } catch (error) {
    console.error("Error fetching inventory locations:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch inventory locations",
    };
  }
}

/**
 * Create a new inventory location
 */
export async function createInventoryLocation(
  data: InventoryLocationData
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
        error: "Store not found. Please set up your store information first.",
      };
    }

    const storeId = storeResult[0].id;

    const newLocation = await db
      .insert(inventoryLocations)
      .values({
        storeId,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        fulfillmentRules: data.fulfillmentRules?.trim() || null,
        isActive: data.isActive ?? true,
      })
      .returning();

    return {
      success: true,
      message: "Inventory location created successfully",
      result: { id: newLocation[0].id },
    };
  } catch (error) {
    console.error("Error creating inventory location:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create inventory location",
    };
  }
}

/**
 * Get all inventory locations (including inactive) for the current store
 * Used for location management in settings
 */
export async function getAllInventoryLocations(): Promise<
  ActionResponse & {
    result?: Array<{
      id: string;
      name: string;
      address: string | null;
      phone: string | null;
      fulfillmentRules: string | null;
      isActive: boolean;
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
        error: "Store not found. Please set up your store information first.",
      };
    }

    const storeId = storeResult[0].id;

    // Get all locations for this store (including inactive)
    const locations = await db
      .select({
        id: inventoryLocations.id,
        name: inventoryLocations.name,
        address: inventoryLocations.address,
        phone: inventoryLocations.phone,
        fulfillmentRules: inventoryLocations.fulfillmentRules,
        isActive: inventoryLocations.isActive,
      })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.storeId, storeId))
      .orderBy(inventoryLocations.name);

    return {
      success: true,
      result: locations.map((loc) => ({
        ...loc,
        isActive: loc.isActive ?? true,
      })),
    };
  } catch (error) {
    console.error("Error fetching inventory locations:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch inventory locations",
    };
  }
}

/**
 * Update an inventory location
 */
export async function updateInventoryLocation(
  locationId: string,
  data: InventoryLocationData
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
        error: "Store not found. Please set up your store information first.",
      };
    }

    const storeId = storeResult[0].id;

    // Verify the location belongs to this store
    const locationResult = await db
      .select({
        id: inventoryLocations.id,
        storeId: inventoryLocations.storeId,
      })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.id, locationId))
      .limit(1);

    if (locationResult.length === 0) {
      return {
        success: false,
        error: "Location not found",
      };
    }

    if (locationResult[0].storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to update this location",
      };
    }

    await db
      .update(inventoryLocations)
      .set({
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        fulfillmentRules: data.fulfillmentRules?.trim() || null,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(inventoryLocations.id, locationId));

    return {
      success: true,
      message: "Inventory location updated successfully",
    };
  } catch (error) {
    console.error("Error updating inventory location:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update inventory location",
    };
  }
}

/**
 * Delete an inventory location
 */
export async function deleteInventoryLocation(
  locationId: string
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
        error: "Store not found. Please set up your store information first.",
      };
    }

    const storeId = storeResult[0].id;

    // Verify the location belongs to this store
    const locationResult = await db
      .select({
        id: inventoryLocations.id,
        storeId: inventoryLocations.storeId,
      })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.id, locationId))
      .limit(1);

    if (locationResult.length === 0) {
      return {
        success: false,
        error: "Location not found",
      };
    }

    if (locationResult[0].storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to delete this location",
      };
    }

    await db
      .delete(inventoryLocations)
      .where(eq(inventoryLocations.id, locationId));

    return {
      success: true,
      message: "Inventory location deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting inventory location:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete inventory location",
    };
  }
}
