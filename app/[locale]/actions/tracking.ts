"use server";

import { db } from "@/db";
import { fulfillments, orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { trackShipment, generateTrackingUrl } from "@/lib/easypost";
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

    // Fetch live tracking from EasyPost
    const trackingInfo = await trackShipment(
      record.trackingNumber,
      record.carrierCode || undefined
    );

    if (!trackingInfo) {
      return {
        success: false,
        error: "Unable to fetch tracking information",
      };
    }

    // Update fulfillment with latest tracking data
    await db
      .update(fulfillments)
      .set({
        trackingStatus: trackingInfo.status,
        trackingData: trackingInfo as unknown as Record<string, unknown>,
        lastTrackedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, fulfillmentId));

    return {
      success: true,
      data: {
        trackingNumber: trackingInfo.tracking_code,
        carrier: record.carrier,
        status: trackingInfo.status,
        estimatedDelivery: trackingInfo.est_delivery_date,
        actualDelivery: trackingInfo.tracking_details?.find((d) =>
          d.status?.toLowerCase().includes("delivered")
        )?.datetime,
        events: trackingInfo.tracking_details.map((detail) => ({
          occurred_at: detail.datetime,
          description: detail.message,
          city_locality: detail.city,
          state_province: detail.state,
          postal_code: detail.zip,
          country_code: detail.country,
        })),
        trackingUrl:
          trackingInfo.public_url ||
          record.trackingUrl ||
          generateTrackingUrl(record.carrier || "", record.trackingNumber),
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

    // Fetch live tracking for each fulfillment
    const trackingPromises = orderFulfillments.map(async (fulfillment) => {
      if (!fulfillment.trackingNumber) {
        return {
          id: fulfillment.id,
          carrier: fulfillment.carrier,
          trackingNumber: null,
          trackingUrl: null,
          status: "No tracking available",
          events: [],
        };
      }

      const trackingInfo = await trackShipment(
        fulfillment.trackingNumber,
        fulfillment.carrierCode || undefined
      );

      // Update tracking data
      if (trackingInfo) {
        await db
          .update(fulfillments)
          .set({
            trackingStatus: trackingInfo.status,
            trackingData: trackingInfo as unknown as Record<string, unknown>,
            lastTrackedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(fulfillments.id, fulfillment.id));
      }

      return {
        id: fulfillment.id,
        carrier: fulfillment.carrier,
        carrierCode: fulfillment.carrierCode,
        trackingNumber: fulfillment.trackingNumber || null,
        trackingUrl:
          trackingInfo?.public_url ||
          fulfillment.trackingUrl ||
          (fulfillment.trackingNumber
            ? generateTrackingUrl(
                fulfillment.carrier || "",
                fulfillment.trackingNumber
              )
            : null),
        status: trackingInfo?.status || "Unknown",
        estimatedDelivery: trackingInfo?.est_delivery_date || null,
        actualDelivery:
          trackingInfo?.tracking_details?.find((d) =>
            d.status?.toLowerCase().includes("delivered")
          )?.datetime || null,
        events:
          trackingInfo?.tracking_details?.map((detail) => ({
            occurred_at: detail.datetime,
            description: detail.message,
            city_locality: detail.city,
            state_province: detail.state,
            postal_code: detail.zip,
            country_code: detail.country,
          })) || [],
        fulfilledAt: fulfillment.fulfilledAt,
      };
    });

    const trackingData = await Promise.all(trackingPromises);

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
