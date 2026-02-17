"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { userRoles, roles, storeMembers, store, customers } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get current user's store ID and role flags. Used by order/dashboard actions.
 * Kept in a small module so order-detail and other pages don't pull in the full orders.ts.
 */
export async function getStoreIdForUser(): Promise<{
  storeId: string | null;
  isAdmin: boolean;
  isCustomer: boolean;
  customerId: string | null;
  allCustomerIds: string[];
  error?: string;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return {
      storeId: null,
      isAdmin: false,
      isCustomer: false,
      customerId: null,
      allCustomerIds: [],
      error: "Unauthorized",
    };
  }

  const userRole = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id))
    .limit(1);

  const isAdmin =
    userRole.length > 0 && userRole[0].roleName?.toLowerCase() === "admin";

  const customerRecords = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, session.user.id));

  const allCustomerIds = customerRecords.map((c) => c.id);
  const customerId = allCustomerIds.length > 0 ? allCustomerIds[0] : null;
  const isCustomer = allCustomerIds.length > 0;

  if (isCustomer) {
    return {
      storeId: null,
      isAdmin: false,
      isCustomer: true,
      customerId,
      allCustomerIds,
    };
  }

  const storeResult = await db
    .select({ id: store.id })
    .from(storeMembers)
    .innerJoin(store, eq(storeMembers.storeId, store.id))
    .where(eq(storeMembers.userId, session.user.id))
    .limit(1);

  if (storeResult.length === 0) {
    return {
      storeId: null,
      isAdmin,
      isCustomer: false,
      customerId: null,
      allCustomerIds: [],
      error: "Store not found. Please set up your store information.",
    };
  }

  return {
    storeId: storeResult[0].id,
    isAdmin,
    isCustomer: false,
    customerId: null,
    allCustomerIds: [],
  };
}
