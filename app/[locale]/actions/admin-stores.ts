"use server";

import { db } from "@/db";
import { store, storeMembers, user, listing } from "@/db/schema";
import { eq, and, or, like, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getCurrentAdmin } from "./admin";

export interface StoreOwner {
  name: string | null;
  email: string | null;
}

export interface StoreWithOwner {
  id: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  isApproved: boolean;
  approvedAt: Date | null;
  createdAt: Date;
  /** First owner (for backward compatibility) */
  ownerName: string | null;
  ownerEmail: string | null;
  /** All admin members / owners for this store */
  owners: StoreOwner[];
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

  // Group by store: one row per store, aggregate all owners (admins) into owners[]
  const byStore = new Map<
    string,
    {
      id: string;
      storeName: string;
      slug: string;
      logoUrl: string | null;
      isApproved: boolean;
      approvedAt: Date | null;
      createdAt: Date;
      owners: StoreOwner[];
    }
  >();
  for (const row of stores) {
    const existing = byStore.get(row.id);
    const owner: StoreOwner = {
      name: row.ownerName,
      email: row.ownerEmail,
    };
    if (!existing) {
      byStore.set(row.id, {
        id: row.id,
        storeName: row.storeName,
        slug: row.slug,
        logoUrl: row.logoUrl,
        isApproved: row.isApproved,
        approvedAt: row.approvedAt,
        createdAt: row.createdAt,
        owners: [owner],
      });
    } else {
      // Dedupe by email (same user can't appear twice, but avoid duplicate rows)
      const hasSame = existing.owners.some(
        (o) => (o.email && o.email === owner.email) || (o.email === null && owner.email === null && o.name === owner.name)
      );
      if (!hasSame) existing.owners.push(owner);
    }
  }

  return Array.from(byStore.values()).map((s) => {
    const first = s.owners[0];
    return {
      ...s,
      ownerName: first?.name ?? null,
      ownerEmail: first?.email ?? null,
      productCount: countMap.get(s.id) || 0,
    };
  });
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
