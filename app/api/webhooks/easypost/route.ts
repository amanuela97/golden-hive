import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fulfillments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    // Verify webhook signature (important for production)
    // EasyPost sends webhooks with HMAC signature
    // const signature = req.headers.get("X-EasyPost-Signature");
    // TODO: Implement signature verification using EasyPost webhook secret

    // EasyPost webhook events can be for tracker or shipment
    const trackingCode =
      event.result?.tracking_code ||
      event.result?.tracker?.tracking_code ||
      event.tracking_code;

    if (!trackingCode) {
      console.log("No tracking code in webhook event");
      return NextResponse.json({ received: true });
    }

    // Find fulfillment by tracking number
    const fulfillmentRecords = await db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.trackingNumber, trackingCode))
      .limit(1);

    if (fulfillmentRecords.length === 0) {
      console.log(`Fulfillment not found for tracking: ${trackingCode}`);
      return NextResponse.json({ received: true });
    }

    // Extract status from event
    const status =
      event.result?.status ||
      event.result?.tracker?.status ||
      event.status ||
      "unknown";

    // Update fulfillment with new tracking data
    await db
      .update(fulfillments)
      .set({
        trackingStatus: status,
        trackingData: event as unknown as Record<string, unknown>,
        lastTrackedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.id, fulfillmentRecords[0].id));

    console.log(`Updated tracking for ${trackingCode}: ${status}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
