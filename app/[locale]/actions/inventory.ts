"use server";

import { ActionResponse } from "@/lib/types";
import { db } from "@/db";
import { inventoryLocations, vendor } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export interface InventoryLocationData {
  name: string;
  address?: string;
  isActive?: boolean;
}

/**
 * Get inventory locations for the current vendor
 */
export async function getInventoryLocations(): Promise<
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

    // Get all active locations for this vendor
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

