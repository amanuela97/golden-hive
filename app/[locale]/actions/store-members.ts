"use server";

import { db } from "@/db";
import { storeMembers, store, user, roles, userRoles } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get store ID for current user
 * For admins: returns the shared admin store ID (first store where user is admin member)
 * For sellers: returns their own store ID
 */
export async function getStoreIdForUser(): Promise<{
  storeId: string | null;
  isAdmin: boolean;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { storeId: null, isAdmin: false, error: "Unauthorized" };
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

    if (userRole.length === 0) {
      return { storeId: null, isAdmin: false, error: "User role not found" };
    }

    const roleName = userRole[0].roleName.toLowerCase();
    const isAdmin = roleName === "admin";

    // Get store membership for user
    const membership = await db
      .select({
        storeId: storeMembers.storeId,
        role: storeMembers.role,
      })
      .from(storeMembers)
      .where(eq(storeMembers.userId, session.user.id))
      .limit(1);

    if (membership.length === 0) {
      return {
        storeId: null,
        isAdmin,
        error: isAdmin
          ? "No store found. Please set up your store."
          : "Store not found. Please set up your store.",
      };
    }

    return { storeId: membership[0].storeId, isAdmin };
  } catch (error) {
    console.error("Error getting store ID:", error);
    return {
      storeId: null,
      isAdmin: false,
      error: "Failed to get store ID",
    };
  }
}

/**
 * Get all stores that the current user is a member of
 */
export async function getStoresForUser(): Promise<{
  success: boolean;
  stores?: Array<{
    id: string;
    storeName: string;
    logoUrl: string | null;
    role: "admin" | "seller";
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

    const stores = await db
      .select({
        id: store.id,
        storeName: store.storeName,
        logoUrl: store.logoUrl,
        role: storeMembers.role,
      })
      .from(storeMembers)
      .innerJoin(store, eq(storeMembers.storeId, store.id))
      .where(eq(storeMembers.userId, session.user.id));

    return {
      success: true,
      stores: stores.map((s) => ({
        id: s.id,
        storeName: s.storeName,
        logoUrl: s.logoUrl,
        role: s.role as "admin" | "seller",
      })),
    };
  } catch (error) {
    console.error("Error getting stores for user:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stores",
    };
  }
}

/**
 * Get all stores (for admin to select from)
 */
export async function getAllStores(): Promise<{
  success: boolean;
  stores?: Array<{
    id: string;
    storeName: string;
    logoUrl: string | null;
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

    if (!isAdmin) {
      return { success: false, error: "Only admins can view all stores" };
    }

    const stores = await db.select({
      id: store.id,
      storeName: store.storeName,
      logoUrl: store.logoUrl,
    }).from(store);

    return {
      success: true,
      stores,
    };
  } catch (error) {
    console.error("Error getting all stores:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stores",
    };
  }
}

/**
 * Check if user has a store setup
 */
export async function userHasStore(): Promise<{
  hasStore: boolean;
  storeId?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { hasStore: false };
    }

    const membership = await db
      .select({
        storeId: storeMembers.storeId,
      })
      .from(storeMembers)
      .where(eq(storeMembers.userId, session.user.id))
      .limit(1);

    return {
      hasStore: membership.length > 0,
      storeId: membership.length > 0 ? membership[0].storeId : undefined,
    };
  } catch (error) {
    console.error("Error checking user store:", error);
    return { hasStore: false };
  }
}

