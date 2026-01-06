"use server";

import { db } from "@/db";
import { shippingPackages, storeMembers } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// Helper function to get current user's store ID
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

interface CreateShippingPackageParams {
  name: string;
  description?: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  isDefault?: boolean;
}

/**
 * Create a custom shipping package
 */
export async function createShippingPackage(
  params: CreateShippingPackageParams
): Promise<{ success: boolean; error?: string; packageId?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const storeId = await getCurrentUserStoreId();
    if (!storeId) {
      return { success: false, error: "Store not found. Please set up your store first." };
    }

    const {
      name,
      description,
      lengthIn,
      widthIn,
      heightIn,
      weightOz,
      isDefault = false,
    } = params;

    // Validate inputs
    if (!name || name.trim().length === 0) {
      return { success: false, error: "Package name is required" };
    }

    if (lengthIn <= 0 || widthIn <= 0 || heightIn <= 0 || weightOz <= 0) {
      return {
        success: false,
        error: "All dimensions and weight must be greater than 0",
      };
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(shippingPackages)
        .set({ isDefault: false })
        .where(eq(shippingPackages.storeId, storeId));
    }

    // Create package
    const [newPackage] = await db
      .insert(shippingPackages)
      .values({
        storeId,
        name: name.trim(),
        description: description?.trim() || null,
        lengthIn: lengthIn.toFixed(2),
        widthIn: widthIn.toFixed(2),
        heightIn: heightIn.toFixed(2),
        weightOz: weightOz.toFixed(2),
        isDefault,
        sortOrder: 0,
      })
      .returning();

    revalidatePath("/dashboard/settings/shipping-settings");

    return { success: true, packageId: newPackage.id };
  } catch (error) {
    console.error("Error creating shipping package:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all shipping packages for the current user's store
 */
export async function getShippingPackages(): Promise<{
  success: boolean;
  error?: string;
  data?: Array<{
    id: string;
    name: string;
    description: string | null;
    lengthIn: number;
    widthIn: number;
    heightIn: number;
    weightOz: number;
    isDefault: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const storeId = await getCurrentUserStoreId();
    if (!storeId) {
      return { success: false, error: "Store not found. Please set up your store first." };
    }

    const packages = await db
      .select()
      .from(shippingPackages)
      .where(eq(shippingPackages.storeId, storeId))
      .orderBy(
        desc(shippingPackages.isDefault),
        desc(shippingPackages.sortOrder)
      );

    return {
      success: true,
      data: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        lengthIn: parseFloat(pkg.lengthIn),
        widthIn: parseFloat(pkg.widthIn),
        heightIn: parseFloat(pkg.heightIn),
        weightOz: parseFloat(pkg.weightOz),
        isDefault: pkg.isDefault,
        sortOrder: pkg.sortOrder,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Error getting shipping packages:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update a shipping package
 */
export async function updateShippingPackage(
  packageId: string,
  params: Partial<CreateShippingPackageParams>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const storeId = await getCurrentUserStoreId();
    if (!storeId) {
      return { success: false, error: "Store not found. Please set up your store first." };
    }

    // Verify package belongs to store
    const [existingPackage] = await db
      .select()
      .from(shippingPackages)
      .where(
        and(
          eq(shippingPackages.id, packageId),
          eq(shippingPackages.storeId, storeId)
        )
      )
      .limit(1);

    if (!existingPackage) {
      return { success: false, error: "Package not found" };
    }

    // If setting as default, unset other defaults
    if (params.isDefault === true) {
      await db
        .update(shippingPackages)
        .set({ isDefault: false })
        .where(
          and(
            eq(shippingPackages.storeId, storeId),
            eq(shippingPackages.isDefault, true)
          )
        );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (params.name !== undefined) {
      updateData.name = params.name.trim();
    }
    if (params.description !== undefined) {
      updateData.description = params.description?.trim() || null;
    }
    if (params.lengthIn !== undefined) {
      updateData.lengthIn = params.lengthIn.toFixed(2);
    }
    if (params.widthIn !== undefined) {
      updateData.widthIn = params.widthIn.toFixed(2);
    }
    if (params.heightIn !== undefined) {
      updateData.heightIn = params.heightIn.toFixed(2);
    }
    if (params.weightOz !== undefined) {
      updateData.weightOz = params.weightOz.toFixed(2);
    }
    if (params.isDefault !== undefined) {
      updateData.isDefault = params.isDefault;
    }

    await db
      .update(shippingPackages)
      .set(updateData)
      .where(eq(shippingPackages.id, packageId));

    revalidatePath("/dashboard/settings/shipping-settings");

    return { success: true };
  } catch (error) {
    console.error("Error updating shipping package:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a shipping package
 */
export async function deleteShippingPackage(
  packageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const storeId = await getCurrentUserStoreId();
    if (!storeId) {
      return { success: false, error: "Store not found. Please set up your store first." };
    }

    // Verify package belongs to store
    const [existingPackage] = await db
      .select()
      .from(shippingPackages)
      .where(
        and(
          eq(shippingPackages.id, packageId),
          eq(shippingPackages.storeId, storeId)
        )
      )
      .limit(1);

    if (!existingPackage) {
      return { success: false, error: "Package not found" };
    }

    await db.delete(shippingPackages).where(eq(shippingPackages.id, packageId));

    revalidatePath("/dashboard/settings/shipping-settings");

    return { success: true };
  } catch (error) {
    console.error("Error deleting shipping package:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
