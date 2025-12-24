"use server";

import { ActionResponse } from "@/lib/types";
import { db } from "@/db";
import { store, storeMembers, storeSlugHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadFile } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";
import { slugify, generateUniqueSlug } from "@/lib/slug-utils";

export interface StoreData {
  storeName: string;
  logoUrl?: string | null;
  storeCurrency: string;
  unitSystem: "Metric system" | "Imperial system";
}

// Alias for backward compatibility
export type VendorData = StoreData;

/**
 * Get store by user ID (through storeMembers)
 */
export async function getStoreByUserId(
  userId: string
): Promise<ActionResponse & { result?: StoreData & { id: string } }> {
  try {
    const result = await db
      .select({
        id: store.id,
        storeName: store.storeName,
        logoUrl: store.logoUrl,
        storeCurrency: store.storeCurrency,
        unitSystem: store.unitSystem,
      })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, userId))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: "Store not found",
      };
    }

    return {
      success: true,
      result: {
        id: result[0].id,
        storeName: result[0].storeName,
        logoUrl: result[0].logoUrl,
        storeCurrency: result[0].storeCurrency,
        unitSystem: result[0].unitSystem as "Metric system" | "Imperial system",
      },
    };
  } catch (error) {
    console.error("Error fetching store:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch store",
    };
  }
}

/**
 * Get store by owner user ID (alias for backward compatibility)
 */
export async function getStoreByOwnerId(
  ownerUserId: string
): Promise<ActionResponse & { result?: StoreData & { id: string } }> {
  return getStoreByUserId(ownerUserId);
}

/**
 * Get store by owner user ID (alias for backward compatibility)
 */
export async function getVendorByOwnerId(
  ownerUserId: string
): Promise<ActionResponse & { result?: VendorData & { id: string } }> {
  return getStoreByOwnerId(ownerUserId);
}

/**
 * Get store by current user
 */
export async function getStore(): Promise<
  ActionResponse & { result?: StoreData & { id: string } }
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

    return await getStoreByUserId(session.user.id);
  } catch (error) {
    console.error("Error fetching store:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch store",
    };
  }
}

/**
 * Get store by current user (alias for backward compatibility)
 */
export async function getVendor(): Promise<
  ActionResponse & { result?: VendorData & { id: string } }
> {
  return getStore();
}

/**
 * Create or update store
 */
export async function upsertStore(
  data: StoreData,
  logoFile?: File
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

    const currentUser = session.user;

    // Get user's store through storeMembers
    const userStore = await db
      .select({
        storeId: storeMembers.storeId,
        role: storeMembers.role,
      })
      .from(storeMembers)
      .where(eq(storeMembers.userId, currentUser.id))
      .limit(1);

    let storeId: string;

    if (userStore.length === 0) {
      // Create new store if it doesn't exist
      const baseSlug = slugify(data.storeName.trim() || "store");
      const uniqueSlug = await generateUniqueSlug(db, baseSlug);
      const slugLower = uniqueSlug.toLowerCase();

      // Upload logo if provided (we'll need to create store first to get storeId)
      let logoUrl: string | null = null;

      const newStore = await db
        .insert(store)
        .values({
          storeName: data.storeName.trim(),
          slug: uniqueSlug,
          slugLower: slugLower,
          storeCurrency: data.storeCurrency,
          unitSystem: data.unitSystem,
          logoUrl: null, // Will update after upload if needed
        })
        .returning();

      storeId = newStore[0].id;

      // Upload logo if provided
      if (logoFile) {
        logoUrl = await uploadFile(logoFile, `store/${storeId}/logo`);
        // Update store with logo URL
        await db.update(store).set({ logoUrl }).where(eq(store.id, storeId));
      } else if (data.logoUrl) {
        // Update with provided logo URL
        await db
          .update(store)
          .set({ logoUrl: data.logoUrl })
          .where(eq(store.id, storeId));
      }

      // Create store member relationship
      await db.insert(storeMembers).values({
        storeId,
        userId: currentUser.id,
        role: "seller", // Default role for new stores
      });

      // Create initial slug history entry
      await db.insert(storeSlugHistory).values({
        storeId,
        slug: uniqueSlug,
        slugLower: slugLower,
        isActive: true,
      });
    } else {
      // Update existing store
      storeId = userStore[0].storeId;

      // Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadFile(logoFile, `store/${storeId}/logo`);
      }

      const storeData = {
        storeName: data.storeName.trim(),
        logoUrl: logoUrl || data.logoUrl || null,
        storeCurrency: data.storeCurrency,
        unitSystem: data.unitSystem,
        updatedAt: new Date(),
      };

      // Update existing store
      await db.update(store).set(storeData).where(eq(store.id, storeId));
    }

    revalidatePath("/dashboard/settings/store");

    return {
      success: true,
      message: "Store updated successfully",
    };
  } catch (error) {
    console.error("Error upserting store:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update store",
    };
  }
}

/**
 * Create or update store (alias for backward compatibility)
 */
export async function upsertVendor(
  data: VendorData,
  logoFile?: File
): Promise<ActionResponse> {
  return upsertStore(data, logoFile);
}
