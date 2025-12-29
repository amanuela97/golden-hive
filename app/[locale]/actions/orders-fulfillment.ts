"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  fulfillments,
  orderEvents,
  inventoryItems,
  inventoryLevels,
  inventoryAdjustments,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getDefaultInventoryLocation } from "./orders";

/**
 * Fulfill an order (per inst.md)
 *
 * This function implements the correct fulfillment logic:
 * - Decreases committed inventory
 * - Decreases on-hand inventory
 * - Does NOT change available inventory (was already reduced when order was created)
 * - Tracks fulfillment per line item (fulfilledQuantity)
 * - Stores fulfillment metadata (carrier, tracking, fulfilledBy)
 *
 * Does NOT:
 * - Change payment status
 * - Issue refunds
 * - Restock inventory
 * - Delete order items
 */
export async function fulfillOrder(input: {
  orderId: string;
  fulfilledItems: Array<{
    orderItemId: string;
    quantity: number; // Quantity to fulfill for this item
  }>;
  carrier?: string; // UPS, Posti, DHL, etc.
  trackingNumber?: string;
  trackingUrl?: string;
  fulfilledBy?: string; // seller / warehouse / automation
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Get order details
    const orderData = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        fulfillmentStatus: orders.fulfillmentStatus,
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

    if (!order.storeId) {
      return { success: false, error: "Order has no store ID" };
    }

    // Validate that order can be fulfilled
    if (order.status === "draft" || order.status === "canceled") {
      return {
        success: false,
        error: "Cannot fulfill draft or canceled orders",
      };
    }

    // Per inst.md: "On hold" blocks fulfillment
    if (order.workflowStatus === "on_hold") {
      return {
        success: false,
        error:
          "Cannot fulfill order that is on hold. Please resolve the hold reason first.",
      };
    }

    // Get order items with current fulfilled quantities
    const items = await db
      .select({
        id: orderItems.id,
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
        fulfilledQuantity: orderItems.fulfilledQuantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, input.orderId));

    if (items.length === 0) {
      return { success: false, error: "Order has no items" };
    }

    // Validate fulfilled items
    const fulfilledItemsMap = new Map(
      input.fulfilledItems.map((item) => [item.orderItemId, item.quantity])
    );

    for (const item of items) {
      const fulfilledQty = fulfilledItemsMap.get(item.id) || 0;
      const currentFulfilled = item.fulfilledQuantity || 0;
      const newFulfilledTotal = currentFulfilled + fulfilledQty;

      if (newFulfilledTotal > item.quantity) {
        return {
          success: false,
          error: `Cannot fulfill more than ordered quantity for item ${item.id}`,
        };
      }

      if (fulfilledQty < 0) {
        return {
          success: false,
          error: `Fulfilled quantity cannot be negative for item ${item.id}`,
        };
      }
    }

    const locationId = await getDefaultInventoryLocation(order.storeId);
    if (!locationId) {
      return { success: false, error: "No inventory location found" };
    }

    // Process fulfillment in transaction
    await db.transaction(async (tx) => {
      const fulfilledAt = new Date();
      let allItemsFulfilled = true;

      // Process each fulfilled item
      for (const fulfilledItem of input.fulfilledItems) {
        if (fulfilledItem.quantity === 0) continue;

        const orderItem = items.find(
          (item) => item.id === fulfilledItem.orderItemId
        );
        if (!orderItem) continue;

        const currentFulfilled = orderItem.fulfilledQuantity || 0;
        const newFulfilledQuantity = currentFulfilled + fulfilledItem.quantity;

        // Update order item fulfilled quantity
        await tx
          .update(orderItems)
          .set({
            fulfilledQuantity: newFulfilledQuantity,
            updatedAt: new Date(),
          })
          .where(eq(orderItems.id, fulfilledItem.orderItemId));

        // Adjust inventory (decrease committed and onHand, NOT available)
        if (orderItem.variantId) {
          const inventoryItem = await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(eq(inventoryItems.variantId, orderItem.variantId))
            .limit(1);

          if (inventoryItem.length > 0) {
            const invItemId = inventoryItem[0].id;

            // Find or create inventory level
            let inventoryLevel = await tx
              .select()
              .from(inventoryLevels)
              .where(
                and(
                  eq(inventoryLevels.inventoryItemId, invItemId),
                  eq(inventoryLevels.locationId, locationId)
                )
              )
              .limit(1);

            if (inventoryLevel.length === 0) {
              await tx.insert(inventoryLevels).values({
                inventoryItemId: invItemId,
                locationId: locationId,
                available: 0,
                committed: 0,
                incoming: 0,
                onHand: 0,
                shipped: 0,
                damaged: 0,
                returned: 0,
              });
              inventoryLevel = await tx
                .select()
                .from(inventoryLevels)
                .where(
                  and(
                    eq(inventoryLevels.inventoryItemId, invItemId),
                    eq(inventoryLevels.locationId, locationId)
                  )
                )
                .limit(1);
            }

            const level = inventoryLevel[0];
            const quantity = fulfilledItem.quantity;

            // Per inst.md: committed -= qty, onHand -= qty, available NO CHANGE
            await tx.insert(inventoryAdjustments).values({
              inventoryItemId: invItemId,
              locationId: locationId,
              change: -quantity,
              reason: "order_fulfilled",
              eventType: "fulfill",
              referenceType: "order",
              referenceId: input.orderId,
              createdBy: userId,
            });

            await tx
              .update(inventoryLevels)
              .set({
                committed: sql`${inventoryLevels.committed} - ${quantity}`,
                onHand: sql`${inventoryLevels.onHand} - ${quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(inventoryLevels.id, level.id));
          }
        }

        // Check if this item is fully fulfilled
        if (newFulfilledQuantity < orderItem.quantity) {
          allItemsFulfilled = false;
        }
      }

      // Create fulfillment record with metadata
      const [fulfillmentRecord] = await tx
        .insert(fulfillments)
        .values({
          orderId: input.orderId,
          storeId: order.storeId,
          locationId: locationId,
          status: "fulfilled",
          carrier: input.carrier || null,
          trackingNumber: input.trackingNumber || null,
          trackingUrl: input.trackingUrl || null,
          fulfilledBy: input.fulfilledBy || "seller",
          fulfilledAt: fulfilledAt,
        })
        .returning();

      // Determine new fulfillment status
      let newFulfillmentStatus: "partial" | "fulfilled" = "partial";
      if (allItemsFulfilled) {
        // Check if all items are fully fulfilled
        const allFulfilled = items.every((item) => {
          const fulfilledQty = fulfilledItemsMap.get(item.id) || 0;
          const currentFulfilled = item.fulfilledQuantity || 0;
          return currentFulfilled + fulfilledQty >= item.quantity;
        });

        if (allFulfilled) {
          newFulfillmentStatus = "fulfilled";
        }
      }

      // Get order payment status to determine if order should be completed
      const orderPaymentData = await tx
        .select({
          paymentStatus: orders.paymentStatus,
          status: orders.status,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      const paymentStatus =
        orderPaymentData.length > 0 ? orderPaymentData[0].paymentStatus : null;
      const currentOrderStatus =
        orderPaymentData.length > 0 ? orderPaymentData[0].status : "open";

      // Determine order status:
      // - If paid and fulfilled → "completed"
      // - Otherwise keep current status
      let newOrderStatus = currentOrderStatus;
      if (
        newFulfillmentStatus === "fulfilled" &&
        (paymentStatus === "paid" || paymentStatus === "partially_refunded")
      ) {
        newOrderStatus = "completed";
        console.log(
          `[Fulfillment] Order ${input.orderId} is paid and fulfilled, setting status to completed`
        );
      }

      // Update order fulfillment status and order status
      await tx
        .update(orders)
        .set({
          fulfillmentStatus: newFulfillmentStatus,
          fulfilledAt:
            newFulfillmentStatus === "fulfilled"
              ? fulfilledAt
              : orders.fulfilledAt,
          status: newOrderStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      // Create timeline event
      await tx.insert(orderEvents).values({
        orderId: input.orderId,
        type: "fulfillment",
        visibility: "public",
        message: `Order ${newFulfillmentStatus === "fulfilled" ? "fulfilled" : "partially fulfilled"}`,
        metadata: {
          fulfillmentId: fulfillmentRecord.id,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          fulfilledItems: input.fulfilledItems,
        },
        createdBy: userId,
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Error fulfilling order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fulfill order",
    };
  }
}
