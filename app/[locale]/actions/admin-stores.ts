"use server";

import { db } from "@/db";
import { store, storeMembers, user, listing } from "@/db/schema";
import { eq, and, or, like, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getCurrentAdmin } from "./admin";

export interface StoreWithOwner {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  isApproved: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  productCount: number;
}

export async function getAllStores(options?: {
  search?: string;
  isApproved?: boolean;
}): Promise<StoreWithOwner[]> {
  await getCurrentAdmin(); // Verify admin access

  const conditions = [];

  if (options?.search) {
    conditions.push(
      or(
        like(store.storeName, `%${options.search}%`),
        like(store.slug, `%${options.search}%`)
      )!
    );
  }

  if (options?.isApproved !== undefined) {
    conditions.push(eq(store.isApproved, options.isApproved));
  }

  const stores = await db
    .select({
      id: store.id,
      storeName: store.storeName,
      slug: store.slug,
      logoUrl: store.logoUrl,
      isApproved: store.isApproved,
      approvedAt: store.approvedAt,
      createdAt: store.createdAt,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(store)
    .leftJoin(
      storeMembers,
      and(eq(storeMembers.storeId, store.id), eq(storeMembers.role, "admin"))
    )
    .leftJoin(user, eq(storeMembers.userId, user.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(store.createdAt));

  // Get product counts for each store
  const productCounts = await db
    .select({
      storeId: listing.storeId,
      count: sql<number>`count(*)`,
    })
    .from(listing)
    .groupBy(listing.storeId);

  const countMap = new Map(
    productCounts.map((pc) => [pc.storeId, Number(pc.count)])
  );

  return stores.map((s) => ({
    ...s,
    productCount: countMap.get(s.id) || 0,
  }));
}

export async function toggleStoreApproval(
  storeId: string,
  isApproved: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await getCurrentAdmin();

    await db
      .update(store)
      .set({
        isApproved,
        approvedAt: isApproved ? new Date() : null,
        approvedBy: isApproved ? admin.id : null,
      })
      .where(eq(store.id, storeId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update approval",
    };
  }
}
