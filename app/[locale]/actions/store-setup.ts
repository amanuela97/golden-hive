"use server";

import { db } from "@/db";
import { store, storeMembers, user, roles, userRoles, markets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { autoAssignMarketToUser, getDefaultMarket } from "./markets";

export interface CreateStoreInput {
  storeName: string;
  storeCurrency: string;
  unitSystem: "Metric system" | "Imperial system";
}

/**
 * Create store and store member for user
 * For admins: creates or finds the shared admin store
 * For sellers: creates their own store
 */
export async function createStoreForUser(
  input: CreateStoreInput
): Promise<{
  success: boolean;
  storeId?: string;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get user role
    const userRole = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId))
      .limit(1);

    if (userRole.length === 0) {
      return { success: false, error: "User role not found" };
    }

    const roleName = userRole[0].roleName.toLowerCase();
    const isAdmin = roleName === "admin";

    return await db.transaction(async (tx) => {
      let storeId: string;

      if (isAdmin) {
        // For admins: find or create the shared admin store
        const existingAdminStore = await tx
          .select({
            id: store.id,
          })
          .from(store)
          .innerJoin(storeMembers, eq(store.id, storeMembers.storeId))
          .where(eq(storeMembers.role, "admin"))
          .limit(1);

        if (existingAdminStore.length > 0) {
          // Use existing admin store
          storeId = existingAdminStore[0].id;

          // Check if user is already a member
          const existingMember = await tx
            .select({ id: storeMembers.id })
            .from(storeMembers)
            .where(
              and(
                eq(storeMembers.storeId, storeId),
                eq(storeMembers.userId, userId)
              )
            )
            .limit(1);

          if (existingMember.length === 0) {
            // Add user as admin member
            await tx.insert(storeMembers).values({
              storeId,
              userId,
              role: "admin",
            });
          }
        } else {
          // Create new admin store
          const newStore = await tx
            .insert(store)
            .values({
              storeName: input.storeName.trim(),
              storeCurrency: input.storeCurrency,
              unitSystem: input.unitSystem,
            })
            .returning();

          storeId = newStore[0].id;

          // Add user as admin member
          await tx.insert(storeMembers).values({
            storeId,
            userId,
            role: "admin",
          });
        }
      } else {
        // For sellers: create their own store
        const newStore = await tx
          .insert(store)
          .values({
            storeName: input.storeName.trim(),
            storeCurrency: input.storeCurrency,
            unitSystem: input.unitSystem,
          })
          .returning();

        storeId = newStore[0].id;

        // Add user as seller member
        await tx.insert(storeMembers).values({
          storeId,
          userId,
          role: "seller",
        });
      }

      // Auto-create market for user (each user gets their own market)
      await autoAssignMarketToUser(userId);

      return { success: true, storeId };
    });
  } catch (error) {
    console.error("Error creating store:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create store",
    };
  }
}

