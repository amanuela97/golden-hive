"use server";

import { db } from "@/db";
import { fulfillments, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Calculate master order fulfillment status from all vendor fulfillments
 */
export async function calculateOrderFulfillmentStatus(
  orderId: string
): Promise<"unfulfilled" | "partial" | "fulfilled" | "canceled"> {
  const orderFulfillments = await db
    .select({
      vendorFulfillmentStatus: fulfillments.vendorFulfillmentStatus,
    })
    .from(fulfillments)
    .where(eq(fulfillments.orderId, orderId));

  if (orderFulfillments.length === 0) {
    return "unfulfilled";
  }

  // Check if any are canceled
  const hasCanceled = orderFulfillments.some(
    (f) => f.vendorFulfillmentStatus === "canceled"
  );
  if (hasCanceled) {
    return "canceled";
  }

  // Check if all are fulfilled
  const allFulfilled = orderFulfillments.every(
    (f) => f.vendorFulfillmentStatus === "fulfilled"
  );
  if (allFulfilled) {
    return "fulfilled";
  }

  // Check if any are fulfilled or partial
  const hasFulfilled = orderFulfillments.some(
    (f) =>
      f.vendorFulfillmentStatus === "fulfilled" ||
      f.vendorFulfillmentStatus === "partial"
  );
  if (hasFulfilled) {
    return "partial";
  }

  return "unfulfilled";
}

/**
 * Update master order fulfillment status
 */
export async function updateOrderFulfillmentStatus(orderId: string) {
  const newStatus = await calculateOrderFulfillmentStatus(orderId);

  await db
    .update(orders)
    .set({
      fulfillmentStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // Revalidate the order page to ensure fresh data
  revalidatePath(`/dashboard/orders/${orderId}`);

  return newStatus;
}
