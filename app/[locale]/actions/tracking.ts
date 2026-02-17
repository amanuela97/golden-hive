"use server";

import { db } from "@/db";
import { fulfillments, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTrackingUrl } from "@/lib/easyship";
import { nanoid } from "nanoid";

/**
 * Get tracking information for a fulfillment
 */
export async function getTrackingInfo(fulfillmentId: string) {
  try {
    const fulfillment = await db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.id, fulfillmentId))
      .limit(1);

    if (fulfillment.length === 0) {
      return { success: false, error: "Fulfillment not found" };
    }

    const record = fulfillment[0];

    if (!record.trackingNumber) {
      return {
        success: false,
        error: "No tracking information available",
      };
    }

    // Use stored tracking data (EasyShip: tracking updates via webhook or carrier link)
    const trackingData = record.trackingData as
      | { tracking_details?: Array<{ datetime?: string; message?: string; status?: string; city?: string; state?: string; zip?: string; country?: string }>; est_delivery_date?: string }
      | null
      | undefined;
    const events = (trackingData?.tracking_details ?? []).map((d) => ({
      occurred_at: d.datetime ?? "",
      description: d.message ?? "",
      city_locality: d.city,
      state_province: d.state,
      postal_code: d.zip,
      country_code: d.country,
    }));
    const trackingUrl =
      record.trackingUrl ||
      generateTrackingUrl(record.carrier || "", record.trackingNumber);

    return {
      success: true,
      data: {
        trackingNumber: record.trackingNumber,
        carrier: record.carrier,
        status: record.trackingStatus ?? "in_transit",
        estimatedDelivery: trackingData?.est_delivery_date ?? undefined,
        actualDelivery: events.find((e) =>
          (e.description || "").toLowerCase().includes("delivered")
        )?.occurred_at,
        events,
        trackingUrl,
      },
    };
  } catch (error) {
    console.error("Error fetching tracking info:", error);
    return {
      success: false,
      error: "Failed to fetch tracking information",
    };
  }
}

/**
 * Get tracking information by order tracking token (for public access)
 */
export async function getPublicTrackingInfo(trackingToken: string) {
  try {
    // Find order by tracking token
    const orderRecords = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerEmail: orders.customerEmail,
        customerFirstName: orders.customerFirstName,
        customerLastName: orders.customerLastName,
        status: orders.status,
        fulfillmentStatus: orders.fulfillmentStatus,
      })
      .from(orders)
      .where(eq(orders.trackingToken, trackingToken))
      .limit(1);

    if (orderRecords.length === 0) {
      return { success: false, error: "Order not found" };
    }

    const order = orderRecords[0];

    // Get all fulfillments for this order
    const orderFulfillments = await db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.orderId, order.id));

    // Use stored tracking data per fulfillment (EasyShip: link to carrier tracking)
    const trackingData = orderFulfillments.map((fulfillment) => {
      if (!fulfillment.trackingNumber) {
        return {
          id: fulfillment.id,
          carrier: fulfillment.carrier,
          trackingNumber: null,
          trackingUrl: null,
          status: "No tracking available",
          events: [],
          fulfilledAt: fulfillment.fulfilledAt,
        };
      }

      const stored = fulfillment.trackingData as
        | { tracking_details?: Array<{ datetime?: string; message?: string; status?: string }>; est_delivery_date?: string }
        | null
        | undefined;
      const events = (stored?.tracking_details ?? []).map((d) => ({
        occurred_at: d.datetime ?? "",
        description: d.message ?? "",
        city_locality: undefined,
        state_province: undefined,
        postal_code: undefined,
        country_code: undefined,
      }));

      return {
        id: fulfillment.id,
        carrier: fulfillment.carrier,
        carrierCode: fulfillment.carrierCode,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl:
          fulfillment.trackingUrl ||
          generateTrackingUrl(
            fulfillment.carrier || "",
            fulfillment.trackingNumber
          ),
        status: fulfillment.trackingStatus ?? "in_transit",
        estimatedDelivery: stored?.est_delivery_date ?? null,
        actualDelivery: events.find((e) =>
          (e.description || "").toLowerCase().includes("delivered")
        )?.occurred_at ?? null,
        events,
        fulfilledAt: fulfillment.fulfilledAt,
      };
    });

    return {
      success: true,
      data: {
        orderNumber: order.orderNumber,
        customerName:
          order.customerFirstName && order.customerLastName
            ? `${order.customerFirstName} ${order.customerLastName}`
            : "Customer",
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        shipments: trackingData,
      },
    };
  } catch (error) {
    console.error("Error fetching public tracking info:", error);
    return {
      success: false,
      error: "Failed to fetch tracking information",
    };
  }
}

/**
 * Generate tracking token for an order
 */
export async function generateOrderTrackingToken(orderId: string) {
  try {
    const token = nanoid(32);

    await db
      .update(orders)
      .set({
        trackingToken: token,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return { success: true, token };
  } catch (error) {
    console.error("Error generating tracking token:", error);
    return { success: false, error: "Failed to generate tracking token" };
  }
}
