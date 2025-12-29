"use server";

import { db } from "@/db";
import {
  store,
  storeSlugHistory,
  storeBannerImage,
  storeAbout,
  storePolicies,
  storeMembers,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadFile } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";
import { getStoreIdForUser } from "./store-members";
import { slugify } from "@/lib/slug-utils";

/**
 * Verify user is store owner/admin
 */
async function verifyStoreAccess(storeId: string): Promise<{
  authorized: boolean;
  error?: string;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { authorized: false, error: "Unauthorized" };
  }

  const member = await db
    .select()
    .from(storeMembers)
    .where(
      and(
        eq(storeMembers.storeId, storeId),
        eq(storeMembers.userId, session.user.id),
        inArray(storeMembers.role, ["admin", "seller"])
      )
    )
    .limit(1);

  if (member.length === 0) {
    return { authorized: false, error: "Forbidden" };
  }

  return { authorized: true };
}

/**
 * Get store with all fields
 */
export async function getStore() {
  try {
    const { storeId } = await getStoreIdForUser();
    if (!storeId) {
      return { success: false, error: "No store found" };
    }

    const storeData = await db
      .select()
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);

    if (storeData.length === 0) {
      return { success: false, error: "Store not found" };
    }

    return { success: true, result: storeData[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch store",
    };
  }
}

/**
 * Update store slug (SEO-safe with redirects)
 */
export async function updateStoreSlug(
  storeId: string,
  newSlug: string
): Promise<{ success: boolean; error?: string }> {
  const access = await verifyStoreAccess(storeId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  const normalized = slugify(newSlug);
  const slugLower = normalized.toLowerCase();

  try {
    return await db.transaction(async (tx) => {
      // Check if slug is taken (excluding current store)
      const existing = await tx
        .select()
        .from(storeSlugHistory)
        .where(eq(storeSlugHistory.slugLower, slugLower))
        .limit(1);

      if (existing.length > 0 && existing[0].storeId !== storeId) {
        return { success: false, error: "Slug already taken" };
      }

      // If slug already exists for this store and is active, no change needed
      if (
        existing.length > 0 &&
        existing[0].storeId === storeId &&
        existing[0].isActive
      ) {
        return { success: true };
      }

      // Deactivate old slug
      await tx
        .update(storeSlugHistory)
        .set({ isActive: false })
        .where(
          and(
            eq(storeSlugHistory.storeId, storeId),
            eq(storeSlugHistory.isActive, true)
          )
        );

      // Insert new slug
      await tx.insert(storeSlugHistory).values({
        storeId,
        slug: normalized,
        slugLower,
        isActive: true,
      });

      // Update store
      await tx
        .update(store)
        .set({
          slug: normalized,
          slugLower,
        })
        .where(eq(store.id, storeId));

      revalidatePath(`/store/${normalized}`);
      return { success: true };
    });
  } catch (error) {
    console.error("Error updating slug:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update slug",
    };
  }
}

/**
 * Update store visibility
 */
export async function updateStoreVisibility(
  storeId: string,
  visibility: "public" | "hidden"
): Promise<{ success: boolean; error?: string }> {
  const access = await verifyStoreAccess(storeId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    await db.update(store).set({ visibility }).where(eq(store.id, storeId));

    revalidatePath(`/store/${storeId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update visibility",
    };
  }
}

/**
 * Get store banners
 */
export async function getStoreBanners() {
  try {
    const { storeId } = await getStoreIdForUser();
    if (!storeId) {
      return { success: false, error: "No store found", banners: [] };
    }

    const banners = await db
      .select()
      .from(storeBannerImage)
      .where(eq(storeBannerImage.storeId, storeId))
      .orderBy(storeBannerImage.sortOrder);

    return { success: true, banners };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch banners",
      banners: [],
    };
  }
}

/**
 * Add banner image
 */
export async function addBannerImage(
  storeId: string,
  file: File,
  alt?: string
): Promise<{ success: boolean; error?: string }> {
  const access = await verifyStoreAccess(storeId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    // Upload image
    const imageUrl = await uploadFile(file, `store/${storeId}/banners`);

    // Get max sortOrder
    const maxOrderResult = await db
      .select({
        max: sql<number>`MAX(${storeBannerImage.sortOrder})`,
      })
      .from(storeBannerImage)
      .where(eq(storeBannerImage.storeId, storeId))
      .limit(1);

    const nextOrder = (maxOrderResult[0]?.max ?? -1) + 1;

    await db.insert(storeBannerImage).values({
      storeId,
      url: imageUrl,
      alt: alt || null,
      sortOrder: nextOrder,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add banner",
    };
  }
}

/**
 * Reorder banner images
 */
export async function reorderBannerImages(
  storeId: string,
  imageIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const access = await verifyStoreAccess(storeId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < imageIds.length; i++) {
        await tx
          .update(storeBannerImage)
          .set({ sortOrder: i })
          .where(
            and(
              eq(storeBannerImage.id, imageIds[i]),
              eq(storeBannerImage.storeId, storeId)
            )
          );
      }
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reorder banners",
    };
  }
}

/**
 * Delete banner image
 */
export async function deleteBannerImage(
  imageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify access through storeId
    const banner = await db
      .select({ storeId: storeBannerImage.storeId })
      .from(storeBannerImage)
      .where(eq(storeBannerImage.id, imageId))
      .limit(1);

    if (banner.length === 0) {
      return { success: false, error: "Banner not found" };
    }

    const access = await verifyStoreAccess(banner[0].storeId);
    if (!access.authorized) {
      return { success: false, error: access.error };
    }

    await db.delete(storeBannerImage).where(eq(storeBannerImage.id, imageId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete banner",
    };
  }
}

/**
 * Get store about section
 */
export async function getStoreAbout() {
  try {
    const { storeId } = await getStoreIdForUser();
    if (!storeId) {
      return { success: false, error: "No store found", about: null };
    }

    const about = await db
      .select()
      .from(storeAbout)
      .where(eq(storeAbout.storeId, storeId))
      .limit(1);

    return { success: true, about: about[0] || null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch about",
      about: null,
    };
  }
}

/**
 * Update store about section
 */
export async function updateStoreAbout(
  storeId: string,
  data: {
    title?: string;
    description?: string;
    imageUrl?: string;
  },
  imageFile?: File
): Promise<{ success: boolean; error?: string }> {
  const access = await verifyStoreAccess(storeId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    let imageUrl = data.imageUrl;

    if (imageFile) {
      imageUrl = await uploadFile(imageFile, `store/${storeId}/about`);
    }

    await db
      .insert(storeAbout)
      .values({
        storeId,
        title: data.title || null,
        description: data.description || null,
        imageUrl: imageUrl || null,
      })
      .onConflictDoUpdate({
        target: storeAbout.storeId,
        set: {
          title: data.title || null,
          description: data.description || null,
          imageUrl: imageUrl || null,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update about",
    };
  }
}

/**
 * Get store policies
 */
export async function getStorePolicies() {
  try {
    const { storeId } = await getStoreIdForUser();
    if (!storeId) {
      return { success: false, error: "No store found", policies: null };
    }

    const policies = await db
      .select()
      .from(storePolicies)
      .where(eq(storePolicies.storeId, storeId))
      .limit(1);

    return { success: true, policies: policies[0] || null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch policies",
      policies: null,
    };
  }
}

/**
 * Update store policies
 */
export async function updateStorePolicies(
  storeId: string,
  data: {
    shipping?: string;
    returns?: string;
    cancellations?: string;
    customOrders?: string;
    privacy?: string;
    additional?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const access = await verifyStoreAccess(storeId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    await db
      .insert(storePolicies)
      .values({
        storeId,
        shipping: data.shipping || null,
        returns: data.returns || null,
        cancellations: data.cancellations || null,
        customOrders: data.customOrders || null,
        privacy: data.privacy || null,
        additional: data.additional || null,
      })
      .onConflictDoUpdate({
        target: storePolicies.storeId,
        set: {
          shipping: data.shipping || null,
          returns: data.returns || null,
          cancellations: data.cancellations || null,
          customOrders: data.customOrders || null,
          privacy: data.privacy || null,
          additional: data.additional || null,
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update policies",
    };
  }
}
