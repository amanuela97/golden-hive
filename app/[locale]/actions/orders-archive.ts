"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { orders, orderEvents } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getStoreIdForUser } from "./store-id";

export async function archiveOrders(
  orderIds: string[]
): Promise<{ success: boolean; archivedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!orderIds || orderIds.length === 0) {
      return { success: false, error: "No orders selected" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    const ordersData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        archivedAt: orders.archivedAt,
        status: orders.status,
      })
      .from(orders)
      .where(inArray(orders.id, orderIds));

    if (ordersData.length === 0) {
      return { success: false, error: "No orders found" };
    }

    const ordersToArchive = ordersData.filter(
      (order) => !order.archivedAt && order.status !== "archived"
    );

    if (ordersToArchive.length === 0) {
      return {
        success: false,
        error: "No orders can be archived (already archived or invalid status)",
      };
    }

    const validOrderIds: string[] = [];
    for (const order of ordersToArchive) {
      if (isAdmin) {
        validOrderIds.push(order.id);
      } else if (storeId && order.storeId === storeId) {
        validOrderIds.push(order.id);
      }
    }

    if (validOrderIds.length === 0) {
      return {
        success: false,
        error: "You don't have permission to archive these orders",
      };
    }

    const userId = session.user.id;

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          archivedAt: new Date(),
          status: "archived",
          updatedAt: new Date(),
        })
        .where(inArray(orders.id, validOrderIds));

      for (const orderId of validOrderIds) {
        await tx.insert(orderEvents).values({
          orderId: orderId,
          type: "system",
          visibility: "internal",
          message: "Order archived",
          createdBy: userId,
          metadata: {} as Record<string, unknown>,
        });
      }
    });

    return {
      success: true,
      archivedCount: validOrderIds.length,
    };
  } catch (error) {
    console.error("Error archiving orders:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to archive orders",
    };
  }
}

export async function unarchiveOrders(
  orderIds: string[]
): Promise<{ success: boolean; unarchivedCount?: number; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!orderIds || orderIds.length === 0) {
      return { success: false, error: "No orders selected" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    const ordersData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        archivedAt: orders.archivedAt,
      })
      .from(orders)
      .where(inArray(orders.id, orderIds));

    if (ordersData.length === 0) {
      return { success: false, error: "No orders found" };
    }

    const ordersToUnarchive = ordersData.filter((order) => order.archivedAt);

    if (ordersToUnarchive.length === 0) {
      return {
        success: false,
        error: "No orders can be unarchived (not archived)",
      };
    }

    const validOrderIds: string[] = [];
    for (const order of ordersToUnarchive) {
      if (isAdmin) {
        validOrderIds.push(order.id);
      } else if (storeId && order.storeId === storeId) {
        validOrderIds.push(order.id);
      }
    }

    if (validOrderIds.length === 0) {
      return {
        success: false,
        error: "You don't have permission to unarchive these orders",
      };
    }

    const userId = session.user.id;

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          archivedAt: null,
          status: "open",
          updatedAt: new Date(),
        })
        .where(inArray(orders.id, validOrderIds));

      for (const orderId of validOrderIds) {
        await tx.insert(orderEvents).values({
          orderId: orderId,
          type: "system",
          visibility: "internal",
          message: "Order unarchived",
          createdBy: userId,
          metadata: {} as Record<string, unknown>,
        });
      }
    });

    return {
      success: true,
      unarchivedCount: validOrderIds.length,
    };
  } catch (error) {
    console.error("Error unarchiving orders:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to unarchive orders",
    };
  }
}
