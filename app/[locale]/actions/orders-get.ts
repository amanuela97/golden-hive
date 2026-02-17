"use server";

import { db } from "@/db";
import {
  orders,
  orderItems,
  orderEvents,
  orderPayments,
  orderRefunds,
  orderRefundItems,
  orderDiscounts,
  discounts,
  refundRequests,
  listing,
  listingVariants,
  fulfillments,
  type Order,
  type OrderItem,
  type OrderEvent,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getStoreIdForUser } from "./store-id";

export type OrderWithItems = Order & {
  items: Array<
    Pick<
      OrderItem,
      | "id"
      | "listingId"
      | "title"
      | "sku"
      | "quantity"
      | "fulfilledQuantity"
      | "unitPrice"
      | "lineSubtotal"
      | "lineTotal"
      | "currency"
    > & {
      imageUrl: string | null;
      listingSlug: string | null;
      refundableQuantity: number;
    }
  >;
  events: Array<
    Pick<
      OrderEvent,
      | "id"
      | "type"
      | "visibility"
      | "message"
      | "metadata"
      | "createdBy"
      | "createdAt"
    >
  >;
  paymentProvider: string | null;
  discount?: {
    name: string;
    code: string | null;
    valueType: "fixed" | "percentage";
    value: number;
    amount: number;
    currency: string;
  } | null;
};

/**
 * Get order details with items (slim module for order detail page to avoid compiling full orders.ts).
 */
export async function getOrderWithItems(orderId: string): Promise<{
  success: boolean;
  data?: OrderWithItems;
  error?: string;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { storeId, isAdmin } = await getStoreIdForUser();

    if (!orderId || typeof orderId !== "string" || orderId.length !== 36) {
      return { success: false, error: "Invalid order ID" };
    }

    const orderData = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderData[0];

    if (!isAdmin && order.storeId !== storeId) {
      return {
        success: false,
        error: "You don't have permission to view this order",
      };
    }

    const itemConditions: Array<ReturnType<typeof eq>> = [
      eq(orderItems.orderId, orderId),
    ];
    if (!isAdmin && storeId) {
      itemConditions.push(eq(listing.storeId, storeId));
    }

    const items = await db
      .select({
        id: orderItems.id,
        listingId: orderItems.listingId,
        title: orderItems.title,
        sku: orderItems.sku,
        quantity: orderItems.quantity,
        fulfilledQuantity: orderItems.fulfilledQuantity,
        unitPrice: orderItems.unitPrice,
        lineSubtotal: orderItems.lineSubtotal,
        lineTotal: orderItems.lineTotal,
        currency: orderItems.currency,
        variantImageUrl: listingVariants.imageUrl,
        listingImageUrl: listing.imageUrl,
        listingSlug: listing.slug,
      })
      .from(orderItems)
      .innerJoin(listing, eq(orderItems.listingId, listing.id))
      .leftJoin(listingVariants, eq(orderItems.variantId, listingVariants.id))
      .where(and(...itemConditions));

    const events = await db
      .select({
        id: orderEvents.id,
        type: orderEvents.type,
        visibility: orderEvents.visibility,
        message: orderEvents.message,
        metadata: orderEvents.metadata,
        createdBy: orderEvents.createdBy,
        createdAt: orderEvents.createdAt,
      })
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId))
      .orderBy(desc(orderEvents.createdAt));

    const refundItems = await db
      .select({
        orderItemId: orderRefundItems.orderItemId,
        quantity: orderRefundItems.quantity,
      })
      .from(orderRefundItems)
      .innerJoin(orderRefunds, eq(orderRefundItems.refundId, orderRefunds.id))
      .where(
        and(
          eq(orderRefunds.orderId, orderId),
          eq(orderRefunds.status, "succeeded")
        )
      );

    const refundedQuantities = new Map<string, number>();
    for (const refundItem of refundItems) {
      const current = refundedQuantities.get(refundItem.orderItemId) || 0;
      refundedQuantities.set(
        refundItem.orderItemId,
        current + refundItem.quantity
      );
    }

    const paymentData = await db
      .select({ provider: orderPayments.provider })
      .from(orderPayments)
      .where(
        and(
          eq(orderPayments.orderId, orderId),
          eq(orderPayments.status, "completed")
        )
      )
      .orderBy(asc(orderPayments.createdAt))
      .limit(1);

    const paymentProvider =
      paymentData.length > 0 ? paymentData[0].provider : null;

    const discountData = await db
      .select({
        code: orderDiscounts.code,
        valueType: orderDiscounts.valueType,
        value: orderDiscounts.value,
        amount: orderDiscounts.amount,
        currency: orderDiscounts.currency,
        discountId: orderDiscounts.discountId,
        discountName: discounts.name,
      })
      .from(orderDiscounts)
      .leftJoin(discounts, eq(orderDiscounts.discountId, discounts.id))
      .where(eq(orderDiscounts.orderId, orderId))
      .limit(1);

    const discount =
      discountData.length > 0
        ? {
            name: discountData[0].discountName || "Custom discount",
            code: discountData[0].code,
            valueType: discountData[0].valueType as "fixed" | "percentage",
            value: parseFloat(discountData[0].value),
            amount: parseFloat(discountData[0].amount),
            currency: discountData[0].currency,
          }
        : null;

    const fulfillmentData = await db
      .select({
        trackingNumber: fulfillments.trackingNumber,
        carrier: fulfillments.carrier,
        labelUrl: fulfillments.labelUrl,
        labelFileType: fulfillments.labelFileType,
      })
      .from(fulfillments)
      .where(
        and(
          eq(fulfillments.orderId, orderId),
          ...(!isAdmin && storeId ? [eq(fulfillments.storeId, storeId)] : [])
        )
      )
      .limit(1);

    const fulfillmentInfo =
      fulfillmentData.length > 0
        ? {
            trackingNumber: fulfillmentData[0].trackingNumber,
            carrier: fulfillmentData[0].carrier,
            labelUrl: fulfillmentData[0].labelUrl,
            labelFileType: fulfillmentData[0].labelFileType,
          }
        : {
            trackingNumber: null,
            carrier: null,
            labelUrl: null,
            labelFileType: null,
          };

    const refundRequestData = await db
      .select({
        id: refundRequests.id,
        status: refundRequests.status,
        rejectionReason: refundRequests.rejectionReason,
        reviewedAt: refundRequests.reviewedAt,
      })
      .from(refundRequests)
      .where(eq(refundRequests.orderId, orderId))
      .orderBy(desc(refundRequests.createdAt))
      .limit(1);

    const refundRequestInfo =
      refundRequestData.length > 0
        ? {
            id: refundRequestData[0].id,
            status: refundRequestData[0].status,
            rejectionReason: refundRequestData[0].rejectionReason,
            reviewedAt: refundRequestData[0].reviewedAt,
          }
        : null;

    return {
      success: true,
      data: {
        ...order,
        refundRequestedAt: refundRequestInfo?.reviewedAt || null,
        refundRequestStatus: refundRequestInfo?.status || null,
        refundRequestReason: refundRequestInfo?.rejectionReason || null,
        items: items.map((item) => {
          const refundedQty = refundedQuantities.get(item.id) || 0;
          const refundableQty = Math.max(0, item.quantity - refundedQty);
          return {
            id: item.id,
            listingId: item.listingId,
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            fulfilledQuantity: item.fulfilledQuantity || 0,
            unitPrice: item.unitPrice,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            currency: item.currency,
            imageUrl: item.variantImageUrl || item.listingImageUrl || null,
            listingSlug: item.listingSlug,
            refundableQuantity: refundableQty,
          };
        }),
        events: events.map((event) => ({
          id: event.id,
          type: event.type,
          visibility: event.visibility,
          message: event.message,
          metadata: event.metadata as Record<string, unknown> | null,
          createdBy: event.createdBy,
          createdAt: event.createdAt,
        })),
        paymentProvider,
        discount,
        ...fulfillmentInfo,
      },
    };
  } catch (error) {
    console.error("Error fetching order with items:", error);
    if (error instanceof Error) {
      if (
        error.message.includes("Failed query") ||
        error.message.includes("invalid input syntax")
      ) {
        return { success: false, error: "Invalid order ID format" };
      }
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to fetch order" };
  }
}
