"use server";

import { db } from "@/db";
import { orders, orderEvents, orderItems, listing } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Update workflow status (operational flags, per inst.md)
 *
 * This function handles "in_progress" and "on_hold" workflow statuses.
 * These are operational flags that do NOT affect:
 * - Payment status
 * - Fulfillment status
 * - Inventory (available / committed / on-hand)
 * - Stripe actions
 * - Order lifecycle status
 *
 * Rules:
 * - "in_progress": Informational only, doesn't block anything
 * - "on_hold": Blocks fulfillment, but allows refunds and cancellations
 */
export async function updateWorkflowStatus(input: {
  orderId: string;
  workflowStatus: "normal" | "in_progress" | "on_hold";
  holdReason?: string; // Required when workflowStatus is "on_hold"
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get user role and store ID for permission checks
    const { getStoreIdForUser } = await import("./store-id");
    const storeIdResult = await getStoreIdForUser();
    const { storeId, isAdmin, error: storeError } = storeIdResult;

    if (storeError && !isAdmin) {
      return { success: false, error: storeError };
    }

    // Validate holdReason when setting to on_hold
    if (input.workflowStatus === "on_hold" && !input.holdReason?.trim()) {
      return {
        success: false,
        error: "Hold reason is required when setting order to on hold",
      };
    }

    // Get current order state with store ID for permission check
    const orderData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        workflowStatus: orders.workflowStatus,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    // Check permissions: Admin can update any order, sellers can only update their own orders
    if (!isAdmin && storeId) {
      // Check if order belongs to this store or has items from this store
      if (order.storeId !== storeId) {
        // Check if order has items from this store
        const orderItemsWithStores = await db
          .select({ storeId: listing.storeId })
          .from(orderItems)
          .innerJoin(listing, eq(orderItems.listingId, listing.id))
          .where(eq(orderItems.orderId, input.orderId))
          .limit(1);

        const hasStoreItems = orderItemsWithStores.some(
          (item) => item.storeId === storeId
        );

        if (!hasStoreItems) {
          return {
            success: false,
            error:
              "You don't have permission to update this order's workflow status",
          };
        }
      }
    }

    const currentWorkflowStatus = order.workflowStatus;

    // Update workflow status (no inventory, payment, or fulfillment changes)
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          workflowStatus: input.workflowStatus,
          holdReason:
            input.workflowStatus === "on_hold"
              ? input.holdReason?.trim() || null
              : null, // Clear holdReason when not on_hold
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      // Create timeline event
      let message = "";
      if (input.workflowStatus === "in_progress") {
        message = "Order marked as in progress";
      } else if (input.workflowStatus === "on_hold") {
        message = `Order placed on hold: ${input.holdReason}`;
      } else {
        message = "Order workflow status reset to normal";
      }

      await tx.insert(orderEvents).values({
        orderId: input.orderId,
        type: "system",
        visibility: "internal",
        message,
        metadata: {
          workflowStatus: input.workflowStatus,
          holdReason: input.holdReason || null,
          previousWorkflowStatus: currentWorkflowStatus,
        },
        createdBy: userId,
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating workflow status:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update workflow status",
    };
  }
}
