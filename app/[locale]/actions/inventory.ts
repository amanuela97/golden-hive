"use server";

import { ActionResponse } from "@/lib/types";
import { db } from "@/db";
import { inventoryLocations, vendor } from "@/db/schema";
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
 * Get active inventory locations for a vendor
 * Used for product form location selection
 * @param producerId - Optional producer ID. If provided, fetches locations for that producer's vendor.
 *                     If not provided, fetches locations for the current user's vendor.
 */
export async function getInventoryLocations(
  producerId?: string
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

    let vendorId: string;

    // If producerId is provided, get vendor for that producer (for admin editing seller's products)
    if (producerId) {
      const vendorResult = await db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.ownerUserId, producerId))
        .limit(1);

      if (vendorResult.length === 0) {
        return {
          success: false,
          error: "Vendor not found for the specified producer.",
        };
      }

      vendorId = vendorResult[0].id;
    } else {
      // Get vendor for current user
      const vendorResult = await db
        .select({ id: vendor.id })
        .from(vendor)
        .where(eq(vendor.ownerUserId, session.user.id))
        .limit(1);

      if (vendorResult.length === 0) {
        return {
          success: false,
          error: "Vendor not found. Please set up your vendor information first.",
        };
      }

      vendorId = vendorResult[0].id;
    }

    // Get only active locations for this vendor (for product form)
    const locations = await db
      .select({
        id: inventoryLocations.id,
        name: inventoryLocations.name,
        address: inventoryLocations.address,
        isActive: inventoryLocations.isActive,
      })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.vendorId, vendorId),
          eq(inventoryLocations.isActive, true)
        )
      )
      .orderBy(inventoryLocations.name);

    return {
      success: true,
      result: locations,
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

    // Get vendor for current user
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session.user.id))
      .limit(1);

    if (vendorResult.length === 0) {
      return {
        success: false,
        error: "Vendor not found. Please set up your vendor information first.",
      };
    }

    const vendorId = vendorResult[0].id;

    const newLocation = await db
      .insert(inventoryLocations)
      .values({
        vendorId,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        fulfillmentRules: data.fulfillmentRules?.trim() || null,
        isActive: data.isActive ?? true,
      })
      .returning({ id: inventoryLocations.id });

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
 * Get all inventory locations (including inactive) for the current vendor
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

    // Get vendor for current user
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session.user.id))
      .limit(1);

    if (vendorResult.length === 0) {
      return {
        success: false,
        error: "Vendor not found. Please set up your vendor information first.",
      };
    }

    const vendorId = vendorResult[0].id;

    // Get all locations for this vendor (including inactive)
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
      .where(eq(inventoryLocations.vendorId, vendorId))
      .orderBy(inventoryLocations.name);

    return {
      success: true,
      result: locations,
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

    // Get vendor for current user
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session.user.id))
      .limit(1);

    if (vendorResult.length === 0) {
      return {
        success: false,
        error: "Vendor not found. Please set up your vendor information first.",
      };
    }

    const vendorId = vendorResult[0].id;

    // Verify the location belongs to this vendor
    const locationResult = await db
      .select({ id: inventoryLocations.id, vendorId: inventoryLocations.vendorId })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.id, locationId))
      .limit(1);

    if (locationResult.length === 0) {
      return {
        success: false,
        error: "Location not found",
      };
    }

    if (locationResult[0].vendorId !== vendorId) {
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

    // Get vendor for current user
    const vendorResult = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(eq(vendor.ownerUserId, session.user.id))
      .limit(1);

    if (vendorResult.length === 0) {
      return {
        success: false,
        error: "Vendor not found. Please set up your vendor information first.",
      };
    }

    const vendorId = vendorResult[0].id;

    // Verify the location belongs to this vendor
    const locationResult = await db
      .select({ id: inventoryLocations.id, vendorId: inventoryLocations.vendorId })
      .from(inventoryLocations)
      .where(eq(inventoryLocations.id, locationId))
      .limit(1);

    if (locationResult.length === 0) {
      return {
        success: false,
        error: "Location not found",
      };
    }

    if (locationResult[0].vendorId !== vendorId) {
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

